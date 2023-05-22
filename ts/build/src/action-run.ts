import {
    debug,
    endGroup,
    error,
    getInput,
    setFailed,
    startGroup,
    warning,
} from '@actions/core'
import { exec } from '@actions/exec'

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

        const results = [
            await runYarn('auto-gen', 'autogen', skips),
            await runYarn('build', 'build', skips),
            await runYarn('doc', 'doc', skips),
            await checkGitCleanness(skips),
        ]

        if (results.some((result) => result === 'skipped')) {
            warning('Some checks skipped', { title: 'Build' })
        }

        if (results.some((result) => result === 'failure')) {
            setFailed('Job failed because build failed')
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

async function runYarn(
    cmd: string,
    check: string,
    skips: string[],
): Promise<CheckStatus> {
    const title = `Build: ${check}`
    if (skips.includes(check)) {
        warning(`Skipping ${check} check`, { title })
        return 'skipped'
    }

    let output = ''

    function stdout(buffer: Buffer) {
        output += buffer.toString()
    }

    startGroup(check)
    const result = await exec('yarn', [cmd], {
        ignoreReturnCode: true,
        listeners: { stdout },
    })
    endGroup()

    if (result !== 0) {
        error(`Failure:\n${output}`, { title })
    }
    return result === 0 ? 'ok' : 'failure'
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
