import { useEffect, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Terminal as XTerm } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

const Terminal = forwardRef((props, ref) => {
  const terminalRef = useRef(null)
  const xtermRef = useRef(null)
  const fitAddonRef = useRef(null)
  const terminalIdRef = useRef(null)
  const [terminalInfo, setTerminalInfo] = useState(null)

  useEffect(() => {
    if (!terminalRef.current || !window.electronAPI) return

    // Track if this effect has been cleaned up (prevent stale callbacks)
    let isMounted = true

    // Get terminal info
    window.electronAPI.terminal.getInfo().then(info => {
      if (isMounted) setTerminalInfo(info)
    })

    // Create xterm instance with proper terminal emulation
    const term = new XTerm({
      cursorBlink: true,
      fontSize: 9,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#0a0a0a',
        foreground: '#f0f0f0',
        cursor: '#3b82f6',
        black: '#000000',
        red: '#ef4444',
        green: '#10b981',
        yellow: '#f59e0b',
        blue: '#3b82f6',
        magenta: '#a855f7',
        cyan: '#06b6d4',
        white: '#f0f0f0',
        brightBlack: '#6b7280',
        brightRed: '#f87171',
        brightGreen: '#34d399',
        brightYellow: '#fbbf24',
        brightBlue: '#60a5fa',
        brightMagenta: '#c084fc',
        brightCyan: '#22d3ee',
        brightWhite: '#ffffff',
      },
      cols: 80,
      rows: 24,
      // Enable proper terminal features for Claude Code
      allowProposedApi: true,
      // Ensure alt/meta keys work properly
      altClickMovesCursor: false,
      macOptionIsMeta: true,
      // Enable proper rendering
      allowTransparency: false,
      drawBoldTextInBrightColors: true,
    })

    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(terminalRef.current)

    // Handle keyboard events for vim hints integration
    term.attachCustomKeyEventHandler((event) => {
      // If vim hints are active, block xterm from processing letter keys and Escape
      // This lets the vim hints system handle them
      if (window.vimHintsActive) {
        if ((event.key.length === 1 && event.key.match(/[a-z]/i)) || event.key === 'Escape') {
          return false // Don't let xterm handle it - let vim hints handle it
        }
      }

      // Escape key: Go home (only when vim hints not active)
      if (!window.vimHintsActive && event.key === 'Escape') {
        console.log('🏠 Terminal: Escape pressed - dispatching goHome event')
        window.dispatchEvent(new CustomEvent('app:goHome'))
        return false // Don't let xterm handle it
      }

      // Allow all other keys (including 'f') to work normally in terminal
      return true
    })

    xtermRef.current = term
    fitAddonRef.current = fitAddon

    // Create PTY session AFTER fitting terminal to get correct dimensions
    const createSession = async () => {
      try {
        // First, fit the terminal to its container
        fitAddon.fit()
        const { cols, rows } = term
        console.log(`🖥️  Terminal fitted to: ${cols}x${rows}`)

        // Now create PTY with the CORRECT dimensions
        console.log(`🚀 Creating PTY with dimensions: ${cols}x${rows}`)
        const projectRoot = await window.electronAPI.config.getProjectRoot()
        const result = await window.electronAPI.terminal.create({
          cols,
          rows,
          cwd: projectRoot
        })
        terminalIdRef.current = result.id
        console.log(`✅ PTY created with ID: ${result.id}`)

        // Focus terminal after everything is set up
        term.focus()
      } catch (error) {
        term.writeln(`\x1b[1;31mFailed to create terminal: ${error.message}\x1b[0m`)
      }
    }

    // Delay session creation slightly to ensure DOM is ready
    setTimeout(() => {
      createSession()
    }, 100)

    // Handle PTY data (output from shell)
    // Note: isMounted check prevents stale handlers from writing after cleanup
    window.electronAPI.terminal.onData(({ id, data }) => {
      if (isMounted && id === terminalIdRef.current) {
        term.write(data)
        // REMOVED: scrollToBottom() was potentially causing Claude Code rendering issues
      }
    })

    // Handle PTY exit
    window.electronAPI.terminal.onExit(({ id, exitCode }) => {
      if (isMounted && id === terminalIdRef.current) {
        term.writeln(`\r\n\x1b[1;33mShell exited with code ${exitCode}\x1b[0m`)
        term.writeln('\x1b[2mRefresh page to start a new session\x1b[0m')
      }
    })

    // Handle user input (send to PTY)
    term.onData((data) => {
      if (terminalIdRef.current !== null) {
        window.electronAPI.terminal.write(terminalIdRef.current, data)
      }
    })

    // Handle resize
    const handleResize = () => {
      try {
        fitAddon.fit()
        if (terminalIdRef.current !== null) {
          const { cols, rows } = term
          console.log(`📏 Terminal resized to: ${cols}x${rows}`)
          window.electronAPI.terminal.resize(terminalIdRef.current, cols, rows)
        }
      } catch (e) {
        // Silently ignore fit errors during resize
      }
    }

    window.addEventListener('resize', handleResize)

    // Cleanup
    return () => {
      isMounted = false // Prevent stale event handlers from firing
      if (terminalIdRef.current !== null) {
        window.electronAPI.terminal.destroy(terminalIdRef.current)
      }
      term.dispose()
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  // Expose focus method to parent components
  useImperativeHandle(ref, () => ({
    focus: () => {
      if (xtermRef.current) {
        xtermRef.current.focus()
      }
    }
  }))

  return (
    <div className="h-full flex flex-col">
      <div className="flex-1">
        <div
          ref={terminalRef}
          className="h-full w-full rounded-lg overflow-hidden"
          onClick={() => xtermRef.current?.focus()}
        />
      </div>
    </div>
  )
})

Terminal.displayName = 'Terminal'

export default Terminal
