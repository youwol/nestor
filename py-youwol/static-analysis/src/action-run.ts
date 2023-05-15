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
            await checkGitCleanness(skips),
        ]

        if (results.some((result) => result === 'skipped')) {
            warning('Some checks skipped', { title })
        }

        if (results.some((result) => result === 'failure')) {
            setFailed('Static analysis failed')
        }
    } catch (err) {
        if (err instanceof Error) {
            setFailed(err.message)
        } else {
            error(typeof err)
            setFailed('Unexpected error')
        }
    }
}

async function runCheck(
    name: string,
    check: () => Promise<CheckStatus>,
    skips: string[],
): Promise<CheckStatus> {
    const title = `Static Analysis: ${name}`
    if (skips.includes(name)) {
        warning(`Skipping ${name} check`, { title })
        return 'skipped'
    }

    startGroup(name)
    const result = await check()
    endGroup()
    return result
}

async function checkVersionMonotony(): Promise<CheckStatus> {
    const title = 'Static Analysis: version_monotony'

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
    const title = 'Build: git cleanness'
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
