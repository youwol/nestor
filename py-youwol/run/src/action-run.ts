import { sleep } from '@actions/artifact/lib/internal/utils'
import {
    debug,
    endGroup,
    error,
    getInput,
    setFailed,
    startGroup,
} from '@actions/core'
import { exec } from '@actions/exec'
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
    if (pathPyYouwolBinCoverage === undefined) {
        throw Error(
            'Env variable PY_YOUWOL_BIN_COVERAGE not set. Did you run py/prepare ?',
        )
    }
    const pathPyYouwolSources = process.env['PY_YOUWOL_SOURCES']
    if (pathPyYouwolSources === undefined) {
        throw Error(
            'Env variable PY_YOUWOL_SOURCES not set. Did you run py/prepare ?',
        )
    }
    const pathConf = getInput('conf')
    if (pathConf === undefined) {
        throw Error('No configuration file specified')
    }
    const coverage = getInput('coverage') === 'true'
    const name = getInput('name')
    const workingDir = `${os.tmpdir()}/${name}_start_py-youwol`
    const stopScriptPath = `${workingDir}/py-youwol.shutdown.sh`
    const logsPath = `${workingDir}/py-youwol.log`

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
        if (coverage) {
            startGroup(
                `start coverage of ${pathPyYouwolBin} with conf ${pathConf}`,
            )
            await cp(`${pathPyYouwolSources}/pyproject.toml`, workingDir)
            const env = {
                ...process.env,
                COVERAGE_DEBUG_FILE: 'coverage.debug',
                PYTHONPATH: `${pathPyYouwolSources}/src`,
            }
            const child = spawn(
                pathPyYouwolBinCoverage,
                [
                    'run',
                    `--omit=${pathConf}`,
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
            child.stdout.pipe(process.stdout)
            child.stderr.pipe(process.stderr)
            child.on('exit', () => console.log('EXIT'))
            child.on('error', (error) => setFailed(error))
            child.on('close', (e) => console.log(`exit code is ${e}`))
            endGroup()
        } else {
            startGroup(`start ${pathPyYouwolBin} with conf ${pathConf}`)
            const child = spawn(
                pathPyYouwolBin,
                ['--conf', pathConf, '--daemonize'],
                { detached: true, stdio: ['ignore', 'pipe', 'pipe'] },
            )
            child.stdout.pipe(process.stdout)
            child.stderr.pipe(process.stderr)
            child.on('exit', () => console.log('EXIT'))
            child.on('error', (error) => setFailed(error))
            child.on('close', (e) => console.log(`exit code is ${e}`))
            endGroup()
        }

        const started = await waitPyYouwol()

        if (!started) {
            await uploadLogsOnFailure(state)
            setFailed('Py-youwol failed to start')
        }
    } catch (err) {
        await uploadLogsOnFailure(state)
        if (err instanceof Error) {
            setFailed(err.message)
        } else {
            error(typeof err)
            setFailed('Unexpected error')
        }
    } finally {
        await exec('ls', ['-lsa', workingDir])
    }
}

async function waitPyYouwol(): Promise<boolean> {
    let _try = 0
    const timeout = 30
    startGroup(`Trying at most ${timeout} seconds to call healtz endpoint`)
    while (_try <= timeout) {
        _try += 1
        console.log(`try to contact py-youwol instance : ${_try}/${timeout}`)
        try {
            const http = new HttpClient()
            const resp = await http.get('http://localhost:2001/healthz')
            if (resp.message.statusCode !== 200) {
                console.log(
                    `invalid HTTP status "${resp.message.statusCode}:${resp.message.statusMessage}"`,
                )
            } else {
                console.log('get response from endpoint')
                const json = JSON.parse(await resp.readBody())
                const status = json['status']
                if (status == 'py-youwol ok') {
                    console.log('py-youwol successfully started')
                    return true
                } else {
                    console.log(`invalid JSON response status : ${status}`)
                }
            }
        } catch (err) {
            console.log(`failed to contact endpoint : ${err}`)
        }
        await sleep(1000)
    }
    endGroup()
    return false
}
