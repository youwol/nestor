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
import {
    execute_with_json_output,
    execute_with_string_output,
} from './step_executor'

export type CheckStatus = 'ok' | 'failure' | 'skipped'

export async function run(): Promise<void> {
    const path = process.env['YARN_INSTALLED']
    if (path === undefined) {
        throw Error(
            'Env variable YARN_INSTALLED not set. Did you run ts/prepare ?',
        )
    } else {
        process.chdir(path)
    }
    const skips = getInput('skip')
        .split(' ')
        .map((skip) => skip.trim())
    try {
        debug('Starting action')
        const title = 'Static Analysis'
        const results = [
            await runCheck('audit', run_audit, skips),
            await runCheck('eslint', run_eslint, skips),
            await runCheck('prettier', run_prettier, skips),
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

interface AuditSummary {
    type: 'auditSummary'
    data: {
        vulnerabilities: {
            info: number
            low: number
            moderate: number
            high: number
            critical: number
        }
        dependencies: number
        devDependencies: number
        optionalDependencies: number
        totalDependencies: number
    }
}

function isAuditSummary(v: unknown): v is AuditSummary {
    return (
        typeof v === 'object' &&
        v !== null &&
        'type' in v &&
        (v as { type: string }).type === 'auditSummary'
    )
}

async function run_audit(): Promise<CheckStatus> {
    function output_cb(json: unknown) {
        if (isAuditSummary(json)) {
            const data = json.data
            notice(
                `${data.totalDependencies} dependencies (dev: ${data.devDependencies}, optional: ${data.optionalDependencies})`,
                { title: 'Audit: Dependencies' },
            )
            const vulns = data.vulnerabilities
            let vuln_msg = ''
            vuln_msg += vulns.low !== 0 ? `low: ${vulns.low}` : ''
            vuln_msg +=
                vulns.moderate !== 0 ? `moderate: ${vulns.moderate}` : ''
            vuln_msg += vulns.info !== 0 ? `info: ${vulns.info}` : ''
            vuln_msg += vulns.high !== 0 ? `high: ${vulns.high}` : ''
            vuln_msg +=
                vulns.critical !== 0 ? `critical: ${vulns.critical}` : ''
            if (vuln_msg !== '') {
                error(vuln_msg, { title: 'Audit: Vulnerabilities' })
            }
        }
    }

    return execute_with_json_output(
        'yarn',
        ['-s', 'audit', '--json'],
        output_cb,
    )
}

interface EslintOutput {
    filePath: string
    messages: [
        {
            ruleId: string
            message: string
            line: number
            endLine: number
            column: number
            endColumn: number
            severity: number
        },
    ]
}

function isEslintOutput(v: unknown): v is EslintOutput {
    return typeof v === 'object' && v !== null && 'filePath' in v
}

async function run_eslint(): Promise<CheckStatus> {
    function output_cb(json: unknown) {
        if (isEslintOutput(json)) {
            json.messages
                .map((msg) => ({
                    cmd:
                        msg.severity === 1
                            ? warning
                            : msg.severity === 2
                            ? error
                            : null,
                    msg,
                }))
                .forEach(
                    ({ cmd, msg }) =>
                        cmd !== null &&
                        cmd(msg.message, {
                            title: `Eslint: ${msg.ruleId}`,
                            file: json.filePath,
                            startLine: msg.line,
                            startColumn: msg.column,
                            endLine: msg.endLine,
                            endColumn: msg.endColumn,
                        }),
                )
        }
    }

    return execute_with_json_output(
        'yarn',
        ['-s', 'eslint', '.', '-f', 'json'],
        output_cb,
    )
}

async function run_prettier(): Promise<CheckStatus> {
    function output_cb(line: string) {
        error('Mal-formatted file', {
            title: 'Prettier: Code style issue',
            file: line,
        })
    }

    return execute_with_string_output(
        'yarn',
        ['-s', 'prettier', '--list-different', '.'],
        output_cb,
    )
}
