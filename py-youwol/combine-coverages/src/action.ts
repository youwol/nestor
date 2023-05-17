import { setFailed } from '@actions/core'
import { run } from './action-run'

run().catch((error) => setFailed('Workflow failed! ' + error.message))
