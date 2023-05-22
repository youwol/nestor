import { create } from '@actions/artifact'
import { error } from '@actions/core'
import { exec } from '@actions/exec'
import fs from 'fs'
import { State } from './state'

export async function uploadLogsOnFailure(state: State) {
    if (fs.existsSync(state.logsPath)) {
        const artifactClient = create()
        try {
            await artifactClient.uploadArtifact(
                `${state.name}_failure`,
                [state.logsPath],
                state.workingDir,
            )
        } catch (err) {
            error(`Failed to upload logs on failure : ${err}`)
        }
    }
}

export async function exec_coverage(
    cmd: string,
    logs_prefix: string,
    args: string[] = [],
): Promise<boolean> {
    const title = `Coverage ${cmd}`
    args.push(cmd)
    const log_file = fs.createWriteStream(`${logs_prefix}.log`)

    const exit_code = await exec('coverage', args, {
        env: {
            ...process.env,
            COVERAGE_DEBUG_FILE: `${logs_prefix}.debug`,
        },
        ignoreReturnCode: true,
        outStream: log_file,
        errStream: log_file,
    })
    if (exit_code === 0) {
        return true
    } else {
        error(`execution of coverage ${cmd} failed`, { title })
        return false
    }
}
