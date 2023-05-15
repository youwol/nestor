import { debug, error, setFailed, warning } from '@actions/core'

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
        const title = 'Build'
        warning('Not yet implemented', { title })
    } catch (err) {
        if (err instanceof Error) {
            setFailed(err.message)
        } else {
            error(typeof err)
            setFailed('Unexpected error')
        }
    }
}
