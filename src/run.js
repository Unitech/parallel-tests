'use strict'

const async = require('async')
const childProcess = require('child_process')

module.exports = class Runner {
  /**
   * Init a new runner
   * @param {Array} commands List of commands to execute
   * @param {Number} number Number of commands to execute in parallel
   */
  constructor (commands, number) {
    this.commands = commands
    this.number = number
    this.startTime = 0
    this.failedTestsOutput = {}
    this.sucessfulTests = 0
    this.failedTests = 0
  }

  /**
   * Launch commands in parallel
   */
  start () {
    this.startTime = new Date()

    process.stdout.write(`Running ${this.commands.length} tests:\n`)
    async.eachLimit(this.commands, this.number, (command, next) => {
      let time = new Date().getTime()

      process.stdout.write(`- [STARTING] ${command}\n`)
      return this.launch(command, (err, success) => {
        if (err != null || success == false) {
          process.stdout.write(`- [WILL RETRY] ${command}: ${success ? '\x1B[0;32m✓' : '\x1B[0;31m✗'}\x1B[0m (Time: ${(new Date().getTime() - time) / 1000}s)\n`)
          return this.launch(command, (err, success) => {
            process.stdout.write(`- [FAILED] ${command}: ${success ? '\x1B[0;32m✓' : '\x1B[0;31m✗'}\x1B[0m (Time: ${(new Date().getTime() - time) / 1000}s)\n`)
            if (err) return next(err)
            if (success == false) return next(new Error(`${command} failed`))
            return next()
          })
        }

        process.stdout.write(`- [SUCCESS] ${command}: ${success ? '\x1B[0;32m✓' : '\x1B[0;31m✗'}\x1B[0m (Time: ${(new Date().getTime() - time) / 1000}s)\n`)
        return next()
      })
    }, (err) => {
      if (err) {
        process.stderr.write(err.message)
      }

      return this.exit()
    })
  }

  /**
   * Exit the program with exit code 0 with 100% successful tests or 1 as exit code otherwise
   * And print output from failed tests
   */
  exit () {
    // Write to stderr failed tests output
    if (this.failedTests > 0) {
      process.stdout.write('\n\n==============================\n')
      process.stdout.write(Object.keys(this.failedTestsOutput).map((test) => {
        return `--> ${test}\n\n${this.failedTestsOutput[test]}`
      }).join('\n\n==============================\n'))
    }

    // Write summary
    process.stdout.write(
      `\n\n------------------------------\n` +
      `SUCCESSFUL TESTS: ${this.sucessfulTests}\n` +
      `FAILED TESTS: ${this.failedTests}\n` +
      `Time: ${Math.ceil(Math.abs(new Date().getTime() - this.startTime.getTime()) / 1000)} secs.\n`
    )

    // Exit
    return process.exit(this.failedTests > 0)
  }

  /**
   * Execute command
   * @param {String} command Command to execute
   * @param {Function} callback Called with <err> at the end
   */
  launch (command, next) {
    const args = command.split(' ')
    args.shift()
    const commandProcess = childProcess.spawn(command.split(' ')[0], args)
    let output = ''

    commandProcess.stdout.on('data', (data) => {
      output += data
    })
    commandProcess.stderr.on('data', (data) => {
      output += data
    })

    commandProcess.on('error', (err) => {
      output = err.message
    })
    commandProcess.on('close', (code) => {
      if (code === 0) {
        this.sucessfulTests++
        return next(null, true)
      }
      this.failedTests++
      this.addToFinalOutput(command, output)
      return next(new Error('test suite has failed'), false)
    })
  }

  /**
   * Add to final output (failed test)
   * @param {String} command Runned command
   * @param {String} stdout Stdout from the test
   * @param {String} stderr Stderr from the test
   */
  addToFinalOutput (command, output) {
    this.failedTestsOutput[command] = output
  }
}
