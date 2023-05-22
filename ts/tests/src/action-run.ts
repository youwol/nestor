import { debug, endGroup, getInput, setFailed, startGroup } from '@actions/core'
import { exec } from '@actions/exec'

export async function run(): Promise<void> {
    const path = process.env['YARN_INSTALLED']
    if (path === undefined) {
        throw Error(
            'Env variable YARN_INSTALLED not set. Did you run ts/prepare ?',
        )
    } else {
        process.chdir(path)
    }
    const coverage = getInput('coverage') === 'true'

    try {
        debug('Starting action')

        startGroup('Run tests')
        let result = 0
        const args = ['--reporters=default', '--reporters=github-actions']
        if (coverage) {
            result = await exec('yarn', ['-s', 'test-coverage', ...args], {
                ignoreReturnCode: true,
            })
        } else {
            result = await exec('yarn', ['-s', 'test', ...args], {
                ignoreReturnCode: true,
            })
        }
        if (result !== 0) {
            setFailed('Job failed because some tests failed')
        }
        endGroup()
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
