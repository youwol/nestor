import { create } from '@actions/artifact'
import { endGroup, error, setFailed, startGroup, warning } from '@actions/core'
import { exec } from '@actions/exec'
import * as glob from '@actions/glob'
import fs from 'fs'
import { exec_coverage, uploadLogsOnFailure } from './commons'
import { getState, State } from './state'

export async function run() {
    const state = getState()
    const artifacts = []
    artifacts.push(state.logsPath)
    process.chdir(state.workingDir)

    try {
        let stopped = false
        startGroup('stopping py-youwol')
        if (!fs.existsSync(state.stopScriptPath)) {
            setFailed(
                `Job failed because py-youwol stopping script ${state.stopScriptPath} does not exist`,
            )
        } else {
            const result = await exec('sh', [state.stopScriptPath])
            if (result !== 0) {
                setFailed('Job failed because py-youwol failed to stop')
            } else {
                stopped = true
            }
        }
        endGroup()

        if (stopped && state.coverage) {
            artifacts.push('coverage.coverage')
            artifacts.push('coverage.debug')

            startGroup('generate HTML coverage report')
            const result_html = await exec_coverage('html', 'coverage_html')
            artifacts.push('coverage_html.debug')
            artifacts.push('coverage_html.log')
            if (result_html) {
                const glober = await glob.create('./htmlcov/')
                for await (const file of glober.globGenerator()) {
                    artifacts.push(file)
                }
            }
            endGroup()

            startGroup('generate XML coverage report')
            const result_xml = await exec_coverage('xml', 'coverage_xml')
            artifacts.push('coverage_xml.debug')
            artifacts.push('coverage_xml.log')
            if (result_xml) {
                artifacts.push('coverage.xml')
            }
            endGroup()
        }
    } catch (err) {
        let err_msg
        if (err instanceof Error) {
            err_msg = err.message
        } else {
            err_msg = `error of type ${typeof err}`
        }
        setFailed(`Job failed because of unexpected error : ${err_msg}`)
    } finally {
        await uploadFiles(state, artifacts)
    }
}

async function uploadFiles(state: State, artifacts: string[]): Promise<void> {
    const title = 'Py-youwol execution artifacts'
    const artifactClient = create()
    artifacts
        .filter((path) => !fs.existsSync(path))
        .forEach((path) => warning(`File not found: ${path}`, { title }))
    const finalArtifacts = artifacts.filter((path) => fs.existsSync(path))

    try {
        await artifactClient.uploadArtifact(
            state.name,
            finalArtifacts,
            state.workingDir,
        )
    } catch (err) {
        await uploadLogsOnFailure(state)
        error(`Upload failed : ${err}`, { title })
        setFailed(`Job failed because upload of artifacts failed`)
    }
}

run().catch((error) => setFailed(`Job failed to execute : ${error.message}`))
