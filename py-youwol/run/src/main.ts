import { run } from './action-run'

function main(): void {
    console.log('Running from main function')
    run().then(() => console.log('Done'))
}

if (require.main === module) {
    main()
}
