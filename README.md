# Utilities

[Git submodules documentation](https://git-scm.com/docs/git-submodule)

[[_TOC_]]

## Usage



<span style="color:red">**NB Default submodule state is 'detached HEAD', you will LOSE new commits! Keep your eyes that you are on branch  ** </span>

### New
#### Add new submodule
```bash
git submodule add -b main git@github.repo <directory i.e. ./libs/utils>
```

#### Update project

-  `package.json`:  
  
  ```diff
    "scripts": {
  +   "setup": "./<directory>/setup.sh <directory>",
  +   "full-test": "npm run test && npm run build",
  ```
  
- then run

```bash
npm run setup
```

### Existent
#### Clone superproject with submodules
```bash
git clone --branch develop --recurse-submodules git@github.com:Global-Ledger/${SUPERPROJECT}.git
```

#### Install submodules after superproject clone 

```bash
git submodule update --init --recursive
```

#### Submodule update

You must consider submodule as ordinary git project - that it's main feature. I.e., if you want to update - just `cd <submodule path> && git pull`. Keep in mind that submodule state should be switched to some branch from default detached-head state

#### Every day of superproject

Done automatically by git-hooks that are instantiated in `npm run setup`. For unsolvable WSL-less Windows issues do manually commands from shell-scripts in`./<this repo path as submodule>/git-hooks`. After pull you need to [`post-checkout`](./git-hooks/post-checkout), before subproject push all submodules' commits should be pushed (regulated by [`recurseSubmodules = on-demand`](./gitconfig))  that is done with [`pre-push`](./git-hooks/pre-push)
