import { sleep } from '@actions/artifact/lib/internal/utils'
import {
    debug,
    endGroup,
    error,
    getInput,
    info,
    setFailed,
    startGroup,
} from '@actions/core'
import { spawn } from 'child_process'
import { cp, mkdirP } from '@actions/io'
import { HttpClient } from '@actions/http-client'
import * as os from 'os'
import { uploadLogsOnFailure } from './commons'
import { saveState } from './state'

export type CheckStatus = 'ok' | 'failure' | 'skipped'

export async function run(): Promise<void> {
    const pathPyYouwolBin = process.env['PY_YOUWOL_BIN']
    if (pathPyYouwolBin === undefined) {
        throw Error(
            'Env variable PY_YOUWOL_BIN not set. Did you run py/prepare ?',
        )
    }
    const pathPyYouwolBinCoverage = process.env['PY_YOUWOL_BIN_COVERAGE']
    const pathPyYouwolSources = process.env['PY_YOUWOL_SOURCES']

    const coverage = getInput('coverage') === 'true'
    const coverageOmit = getInput('coverageOmit')
    const name = getInput('name')
    const workingDir = `${os.tmpdir()}/${name}_start_py-youwol`
    const stopScriptPath = `${workingDir}/py-youwol.shutdown.sh`
    const logsPath = `${workingDir}/py-youwol.log`
    const pathConf =
        getInput('conf') !== ''
            ? getInput('conf')
            : `${pathPyYouwolSources}/integrations/yw_config.py`
    await mkdirP(workingDir)
    process.chdir(workingDir)
    const state = {
        workingDir,
        stopScriptPath,
        pathPyYouwolSources,
        logsPath,
        name,
        coverage,
    }
    saveState(state)

    try {
        debug('Starting action')
        const title = 'Run py-youwol'
        let child
        if (coverage) {
            if (pathPyYouwolBinCoverage === undefined) {
                throw Error(
                    'Env variable PY_YOUWOL_BIN_COVERAGE not set. Did you run py/prepare ?',
                )
            }
            if (pathPyYouwolSources === undefined) {
                throw Error(
                    'Env variable PY_YOUWOL_SOURCES not set. Did you run py/prepare ?',
                )
            }
            startGroup(
                `start coverage of ${pathPyYouwolBin} with conf ${pathConf}`,
            )
            let omit = pathConf
            if (coverageOmit !== undefined && coverageOmit.trim() !== '') {
                omit = `${omit},${coverageOmit}`
            }
            await cp(`${pathPyYouwolSources}/pyproject.toml`, workingDir)
            const env = {
                ...process.env,
                COVERAGE_DEBUG_FILE: 'coverage.debug',
                PYTHONPATH: `${pathPyYouwolSources}/src`,
            }
            child = spawn(
                pathPyYouwolBinCoverage,
                [
                    'run',
                    `--omit=${omit}`,
                    pathPyYouwolBin,
                    '--conf',
                    pathConf,
                    '--daemonize',
                ],
                {
                    detached: true,
                    stdio: ['ignore', 'pipe', 'pipe'],
                    env,
                },
            )
        } else {
            startGroup(`start ${pathPyYouwolBin} with conf ${pathConf}`)
            child = spawn(
                pathPyYouwolBin,
                ['--conf', pathConf, '--daemonize'],
                { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
            )
        }
        child.stdout.pipe(process.stdout)
        child.stderr.pipe(process.stderr)
        child.on('exit', () => info('spawned process exited'))
        child.on('error', (err) =>
            error(`Failed to start py-youwol : ${err.message}`, { title }),
        )
        child.on('close', (e) => info(`spawned process exit code is ${e}`))
        endGroup()

        const started = await waitPyYouwol()

        if (!started) {
            await uploadLogsOnFailure(state)
            setFailed('Job failed because py-youwol failed to start')
        }
    } catch (err) {
        await uploadLogsOnFailure(state)
        let err_msg
        if (err instanceof Error) {
            err_msg = err.message
        } else {
            err_msg = `error of type ${typeof err}`
        }
        setFailed(`Job failed because of unexpected error : ${err_msg}`)
    }
}

async function waitPyYouwol(): Promise<boolean> {
    let _try = 0
    const timeout = 30
    const http = new HttpClient()

    startGroup(`Trying at most ${timeout} seconds to call healtz endpoint`)
    while (_try < timeout) {
        _try += 1
        info(`try to contact py-youwol instance : ${_try}/${timeout}`)
        try {
            const resp = await http.get('http://localhost:2001/healthz')
            if (resp.message.statusCode !== 200) {
                info(
                    `invalid HTTP status "${resp.message.statusCode}:${resp.message.statusMessage}"`,
                )
            } else {
                info('get response from endpoint')
                const json = JSON.parse(await resp.readBody())
                const status = json['status']
                if (status == 'py-youwol ok') {
                    info('py-youwol successfully started')
                    return true
                } else {
                    info(`invalid JSON response status : ${status}`)
                }
            }
        } catch (err) {
            info(`failed to contact endpoint : ${err}`)
        }
        await sleep(1000)
    }
    endGroup()

    error(`Failed to contact py-youwol after ${timeout} seconds`)
    return false
}
