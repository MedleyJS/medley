# Benchmarking

Benchmarking is important if you want to measure how a change can impact
performance. This document describes some benchmarking techniques from the
point of view of a contributor. This setup allows you to run benchmarks on
different branches and with different Node.js versions.

The modules used:

- [autocannon](https://github.com/mcollina/autocannon): An HTTP/1.1 benchmarking tool for Node.
- [branch-comparer](https://github.com/StarpTech/branch-comparer): Checks out multiple git branches, executes scripts, and logs the results.
- [concurrently](https://github.com/kimmobrunfeldt/concurrently): Run commands concurrently.
- [npx](https://github.com/zkat/npx) NPM package runner - We using it to run scripts against different Node.js versions and execute local binaries. Shipped with `npm@5.2.0`.

## Simple

### Run the test in the current branch

```sh
npm run benchmark
```

### Run the test against different Node.js versions ✨

```sh
npx -p node@6 -- npm run benchmark
```

## Advanced

### Run the test in different branches

```sh
branchcmp --rounds 2 --script "npm run benchmark"
```

### Run the test in different branches against different Node.js versions ✨

```sh
branchcmp --rounds 2 --script "npm run benchmark"
```

### Compare current branch with master (Gitflow)

```sh
branchcmp --rounds 2 --gitflow --script "npm run benchmark"
```

or

```sh
npm run bench
```

### Run different benchmarks

```sh
branchcmp --rounds 2 -s "node ./node_modules/concurrently -k -s first \"node ./benchmarks/hooks.js\" \"node ./node_modules/autocannon -c 100 -d 5 -p 10 localhost:3000/\""
```
