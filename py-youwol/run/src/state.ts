import * as core from '@actions/core'

export interface State {
    workingDir: string
    stopScriptPath: string
    logsPath: string
    name: string
    coverage: boolean
}

export function saveState(state: State) {
    core.saveState('state', state)
}

export function getState(): State {
    return JSON.parse(core.getState('state'))
}
