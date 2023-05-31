import {
    debug,
    endGroup,
    error,
    getInput,
    notice,
    setFailed,
    startGroup,
    warning,
} from '@actions/core'
import { exec } from '@actions/exec'
import { rmRF } from '@actions/io'

const mainBranchPath = '.py-youwol_main'
export type CheckStatus = 'ok' | 'failure' | 'skipped'

export async function run(): Promise<void> {
    const pathPyYouwolSources = process.env['PY_YOUWOL_SOURCES']
    if (pathPyYouwolSources === undefined) {
        throw Error(
            'Env variable PY_YOUWOL_SOURCES not set. Did you run py/prepare ?',
        )
    } else {
        process.chdir(pathPyYouwolSources)
    }
    const skips = getInput('skip')
        .split(' ')
        .map((skip) => skip.trim())
    try {
        debug('Starting action')
        const title = 'Static Analysis'

        const results = [
            await runCheck('version_monotony', checkVersionMonotony, skips),
            await runCheck('imports', checkISort, skips),
            await runCheck('formatting', checkBlack, skips),
            await runCheck('pep8', checkPyCodeStyle, skips),
            await runCheck('audit', checkAudit, skips),
            await checkGitCleanness(skips),
        ]

        if (results.some((result) => result === 'skipped')) {
            warning('Some checks skipped', { title })
        }

        if (results.some((result) => result === 'failure')) {
            setFailed('Job failed because some static analysis checks failed')
        }
    } catch (err) {
        let err_msg
        if (err instanceof Error) {
            err_msg = err.message
        } else {
            err_msg = `error of type ${typeof err}`
        }
        setFailed(`Job failed because of unexpected error : ${err_msg}`)
    }
}

async function runCheck(
    name: string,
    check: (title: string) => Promise<CheckStatus>,
    skips: string[],
): Promise<CheckStatus> {
    const title = `Static Analysis: ${name}`
    if (skips.includes(name)) {
        warning(`Skipping ${name} check`, { title })
        return 'skipped'
    }

    startGroup(name)
    const result = await check(title)
    endGroup()
    return result
}

interface PyCodeStyleLine {
    filename: string
    row: number
    col: number
    message: string
}

function isPyCodeStyleLine(v: unknown): v is PyCodeStyleLine {
    return (
        typeof v === 'object' &&
        v !== null &&
        'filename' in v &&
        'row' in v &&
        'col' in v &&
        'message' in v
    )
}

async function checkPyCodeStyle(title: string): Promise<CheckStatus> {
    const customFormat =
        '{"filename":"%(path)s", "row":%(row)d, "col":%(col)d, "message":"[%(code)s] %(text)s"}'

    function stdline(line: string) {
        try {
            const json = JSON.parse(line)
            if (isPyCodeStyleLine(json)) {
                error(json.message, {
                    title,
                    file: json.filename,
                    startColumn: json.col,
                    startLine: json.row,
                })
            } else {
                warning(
                    `Object does not conform to PyCodeStyleLine interface : ${line}`,
                    { title },
                )
            }
        } catch (err) {
            warning(`Cannot parse output line '${line}' : ${err}`, { title })
        }
    }

    const result = await exec(
        'pycodestyle',
        ['src', `--format=${customFormat}`],
        {
            ignoreReturnCode: true,
            listeners: { stdline },
        },
    )

    if (result !== 0) {
        error(`pycodestyle return non zero exit code ${result}`, { title })
        return 'failure'
    }

    return 'ok'
}

async function checkISort(title: string): Promise<CheckStatus> {
    function errline(line: string) {
        if (line.startsWith('ERROR: ')) {
            const endFilename = line.indexOf(' ', 8)
            const file = line.substring(8, endFilename)
            error(line.substring(endFilename + 1), { title, file })
        }
    }

    const result = await exec('isort', ['src', '--check'], {
        ignoreReturnCode: true,
        listeners: { errline },
    })

    if (result !== 0) {
        error(`isort return non zero exit code ${result}`, { title })
        return 'failure'
    }

    return 'ok'
}

async function checkBlack(title: string): Promise<CheckStatus> {
    const result = await exec('black', ['src', '--check'], {
        ignoreReturnCode: true,
    })

    if (result !== 0) {
        error(`black return non zero exit code ${result}`, { title })
        return 'failure'
    }

    return 'ok'
}

interface AuditVulnerability {
    id: string
    fix_versions: string[]
    description: string
}

interface AuditEntry {
    name: string
    version: string
    vulns: AuditVulnerability[]
}

interface AuditOutput {
    dependencies: AuditEntry[]
}

//
// function isAuditEntry(v: unknown): v is AuditEntry {
//     return (
//         typeof v === 'object' &&
//         v !== null &&
//         'name' in v &&
//         'version' in v &&
//         'vulns' in v
//     )
// }
//
function isAuditOutput(v: unknown): v is AuditOutput {
    return typeof v === 'object' && v !== null && 'dependencies' in v
}

async function checkAudit(title: string): Promise<CheckStatus> {
    function stdline(line: string) {
        try {
            const json = JSON.parse(line)
            if (isAuditOutput(json)) {
                json.dependencies.forEach((entry) =>
                    entry.vulns.forEach((vulnerability) =>
                        error(
                            `Package ${entry.name}@${entry.version} has vulnerability:\n[${vulnerability.id}] : ${vulnerability.description}`,
                            { title },
                        ),
                    ),
                )
            } else {
                warning(
                    `Object does not conform to PyCodeStyleLine interface : ${line}`,
                    { title },
                )
            }
        } catch (err) {
            warning(`Cannot parse output line '${line}' : ${err}`, { title })
        }
    }

    const result = await exec(
        'pip-audit',
        [
            '--format=json',
            '--require-hashes',
            '--requirement=requirements-dev.txt',
        ],
        {
            ignoreReturnCode: true,
            listeners: { stdline },
        },
    )

    if (result !== 0) {
        error(`Audit return non zero exit code ${result}`, { title })
        return 'failure'
    }

    return 'ok'
}

async function checkVersionMonotony(title: string): Promise<CheckStatus> {
    let output = ''

    function stdline(line: string) {
        output += line
    }

    const result_main = await exec(
        'python3',
        [`${process.cwd()}/version_management.py`, 'get_current'],
        { cwd: mainBranchPath, listeners: { stdline } },
    )
    if (result_main !== 0) {
        error('Failed to get version of main branch', { title })
        return 'failure'
    }
    await rmRF(mainBranchPath)

    const mainVersion = output.trim()

    output = ''
    const result_current = await exec(
        'python3',
        ['version_management.py', 'get_current'],
        { listeners: { stdline } },
    )
    if (result_current !== 0) {
        error('Failed to get current version', { title })
        return 'failure'
    }
    const currentVersion = output.trim()
    notice(
        `Branch version is ${currentVersion}, main branch version is ${mainVersion}`,
        { title },
    )
    const result_check = await exec('python3', [
        'version_management.py',
        'check',
        mainVersion,
    ])
    if (result_check !== 0) {
        error('Failed to get current version', { title })
        return 'failure'
    }
    return 'ok'
}

async function checkGitCleanness(skips: string[]): Promise<CheckStatus> {
    const title = 'Static Analysis: git cleanness'
    if (skips.includes('cleanness')) {
        warning('Skipping git cleanness check', {
            title,
        })
        return 'skipped'
    }

    const output: string[] = []

    function stdline(line: string) {
        output.push(line)
    }

    startGroup('git cleanness')
    const result = await exec('git', ['status', '-s'], {
        ignoreReturnCode: true,
        listeners: { stdline },
    })
    endGroup()

    if (result !== 0) {
        error(`Git cleanness exit with non-zero code ${result}`, {
            title,
        })
        return 'failure'
    }

    if (output.length != 0) {
        output.forEach((line) => error(`Unclean git : ${line}`, { title }))
        return 'failure'
    }

    return 'ok'
}
