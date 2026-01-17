# Install UX Reference

Target experience: `curl -fsSL https://localbase.ai/install | bash`

## Reference: opencode.ai

```
➜  ~ curl -fsSL https://opencode.ai/install | bash

Installing opencode version: 1.1.25
■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■■ 100%
Successfully added opencode to $PATH in /Users/ryanriggin/.zshrc

                                 ▄
█▀▀█ █▀▀█ █▀▀█ █▀▀▄ █▀▀▀ █▀▀█ █▀▀█ █▀▀█
█░░█ █░░█ █▀▀▀ █░░█ █░░░ █░░█ █░░█ █▀▀▀
▀▀▀▀ █▀▀▀ ▀▀▀▀ ▀  ▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀ ▀▀▀▀


OpenCode includes free models, to start:

cd <project>  # Open directory
opencode      # Run command

For more information visit https://opencode.ai/docs
```

## Key elements

1. One-liner curl - dead simple entry point
2. Progress bar with version - visual feedback during download
3. Auto PATH setup - modifies shell rc file so it just works
4. ASCII art logo - brand moment without being obnoxious
5. Clear next steps - minimal instructions to get started
6. Docs link - one URL for more info

## TODO

- Decide what the CLI does (init new instance? quick demo? something else?)
- Create ASCII logo for LocalBase
- Write install.sh script
- Host somewhere (repo raw file or localbase.ai domain)
