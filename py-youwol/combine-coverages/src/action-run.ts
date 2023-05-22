import { debug, setFailed, warning } from '@actions/core'

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

    try {
        debug('Starting action')
        const title = 'Combine Coverages'
        warning('Not yet implemented', { title })
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
