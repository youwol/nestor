import { exec } from '@actions/exec'
import { CheckStatus } from './action-run'

export async function execute_with_json_output(
    command: string,
    args: string[],
    output_cb: (json: unknown) => void,
): Promise<CheckStatus> {
    let output = ''
    return exec(command, args, {
        silent: true,
        ignoreReturnCode: true,
        listeners: {
            stdout: (data: Buffer) => (output += data.toString()),
        },
    }).then((exit_code) => {
        output
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .flatMap((line) => JSON.parse(line))
            .forEach((jsonline) => output_cb(jsonline))
        return exit_code === 0 ? 'ok' : 'failure'
    })
}

export async function execute_with_string_output(
    command: string,
    args: string[],
    output_cb: (json: string) => void,
): Promise<CheckStatus> {
    let output = ''
    return exec(command, args, {
        silent: true,
        ignoreReturnCode: true,
        listeners: {
            stdout: (data: Buffer) => (output += data.toString()),
        },
    }).then((exit_code) => {
        output
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line !== '')
            .forEach((line) => output_cb(line))
        return exit_code === 0 ? 'ok' : 'failure'
    })
}
