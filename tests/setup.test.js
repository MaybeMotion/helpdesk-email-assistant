import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { macSetupCommand } from '../setup.js';
const extensionId = 'abcdefghijklmnopabcdefghijklmnop';
const origin = `chrome-extension://${extensionId}`;

test('Mac setup command includes only a validated extension origin and local-only setting', () => {
  const command = macSetupCommand(extensionId);
  assert.equal(command, [
    'helpdesk_origins="$(launchctl getenv OLLAMA_ORIGINS)"',
    `launchctl setenv OLLAMA_ORIGINS "\${helpdesk_origins:+$helpdesk_origins,}${origin}"`,
    'launchctl setenv OLLAMA_NO_CLOUD 1'
  ].join('\n'));
});

test('unset, empty, malformed and shell-like extension IDs do not produce commands', () => {
  for (const id of [undefined, null, '', 32, {}, 'a'.repeat(31), 'a'.repeat(33), 'q'.repeat(32), extensionId.toUpperCase(), extensionId + '\n', '$(printf unsafe)', '"; printf unsafe; #']) {
    assert.equal(macSetupCommand(id), '');
  }
});

// The shell function intercepts every launchctl call. No real launchctl or system setting is used.
function simulateLaunchctl(previousOrigins) {
  const script = `
    helpdesk_simulated_origins="$HELPDESK_TEST_ORIGINS"
    helpdesk_simulated_cloud=''
    launchctl() {
      case "$1:$2" in
        getenv:OLLAMA_ORIGINS) printf '%s' "$helpdesk_simulated_origins" ;;
        setenv:OLLAMA_ORIGINS) helpdesk_simulated_origins="$3" ;;
        setenv:OLLAMA_NO_CLOUD) helpdesk_simulated_cloud="$3" ;;
        *) return 1 ;;
      esac
    }
    ${macSetupCommand(extensionId)}
    printf '%s\\n%s' "$helpdesk_simulated_origins" "$helpdesk_simulated_cloud"
  `;
  const result = spawnSync('bash', ['-c', script], {
    encoding: 'utf8',
    env: { ...process.env, HELPDESK_TEST_ORIGINS: previousOrigins }
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.split('\n');
}

test('Mac command avoids an empty origin entry when no origins are configured', () => {
  assert.deepEqual(simulateLaunchctl(''), [origin, '1']);
});

test('Mac command preserves the already-working Rephrase origin and other entries', () => {
  const previous = 'chrome-extension://pppppppppppppppppppppppppppppppp,http://127.0.0.1:3000';
  assert.deepEqual(simulateLaunchctl(previous), [`${previous},${origin}`, '1']);
});

test('existing setting content is kept as data rather than executed as shell code', () => {
  const previous = '$(printf unintended-command)';
  assert.deepEqual(simulateLaunchctl(previous), [`${previous},${origin}`, '1']);
});
