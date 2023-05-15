import {
    debug,
    endGroup,
    error,
    getInput,
    setFailed,
    startGroup,
} from '@actions/core'
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
        if (coverage) {
            result = await exec('yarn', ['test-coverage'])
        } else {
            result = await exec('yarn', ['test'])
        }
        if (result !== 0) {
            setFailed('Test failed')
        }
        endGroup()
    } catch (err) {
        if (err instanceof Error) {
            setFailed(err.message)
        } else {
            error(typeof err)
            setFailed('Unexpected error')
        }
    }
}
