#!/usr/bin/env bash
# Only called after all installer builds/tests pass. The backup is also stored
# as an Actions artifact before publication starts.
set -euo pipefail
version=$(node -p "require('./package.json').version")
tag="v$version"
if [[ "${GITHUB_EVENT_NAME:-}" != workflow_dispatch || "${REPLACE_VERSION:-}" != "$version" || "${GITHUB_REF:-}" != refs/heads/main ]]; then
  echo 'Refusing replacement without an explicit manual request for this version on main.' >&2
  exit 1
fi
api="repos/$GITHUB_REPOSITORY"

case "${1:-}" in
  backup)
    mkdir -p release-backup/assets
    gh api "$api/releases/tags/$tag" > release-backup/release.json
    gh api "$api/git/ref/tags/$tag" > release-backup/tag.json
    python3 - <<'PY'
import json, pathlib
release=json.loads(pathlib.Path('release-backup/release.json').read_text())
assert not release.get('immutable') and not release['draft'], 'Release cannot be replaced'
expected={p.name for p in pathlib.Path('installers').iterdir() if p.is_file()}
assert {a['name'] for a in release['assets']}==expected, 'Unexpected release assets; inspect before replacing'
PY
    gh release download "$tag" --dir release-backup/assets
    python3 - <<'PY'
import hashlib,json,pathlib
release=json.loads(pathlib.Path('release-backup/release.json').read_text())
for asset in release['assets']:
    path=pathlib.Path('release-backup/assets')/asset['name']
    assert path.stat().st_size==asset['size'], f"Incomplete backup: {path.name}"
    if asset.get('digest'):
        assert asset['digest']=='sha256:'+hashlib.sha256(path.read_bytes()).hexdigest(), f"Corrupt backup: {path.name}"
pathlib.Path('release-backup/notes.md').write_text(release.get('body') or '')
PY
    ;;
  publish)
    # Reject a concurrent edit or a newer main before changing public files.
    gh api "$api/releases/tags/$tag" > release-backup/current.json
    python3 - <<'PY'
import json,pathlib
root=pathlib.Path('release-backup')
old=json.loads((root/'release.json').read_text())
current=json.loads((root/'current.json').read_text())
for key in ('id','updated_at','assets','body','immutable','draft'):
    assert old.get(key)==current.get(key), f'Release changed since backup: {key}'
PY
    test "$(gh api "$api/git/ref/heads/main" --jq .object.sha)" = "$GITHUB_SHA"
    old_sha=$(python3 -c "import json; print(json.load(open('release-backup/tag.json'))['object']['sha'])")
    test "$(gh api "$api/git/ref/tags/$tag" --jq .object.sha)" = "$old_sha"
    rollback() {
      trap - ERR
      set +e
      echo 'Publication failed; restoring the previous release from its backup.' >&2
      failed=0
      gh release upload "$tag" release-backup/assets/* --clobber || failed=1
      # Restore the exact old tag object (including annotated tags).
      git fetch origin "$old_sha" || failed=1
      current_sha=$(gh api "$api/git/ref/tags/$tag" --jq .object.sha)
      if [[ "$current_sha" == "$GITHUB_SHA" ]]; then
        git push origin "$old_sha:refs/tags/$tag" --force-with-lease="refs/tags/$tag:$GITHUB_SHA" || failed=1
      elif [[ "$current_sha" != "$old_sha" ]]; then
        failed=1
      fi
      old_target=$(python3 -c "import json; print(json.load(open('release-backup/release.json'))['target_commitish'])")
      gh release edit "$tag" --notes-file release-backup/notes.md --target "$old_target" || failed=1
      if [[ "$failed" == 1 ]]; then
        echo '::error::Automatic restoration was incomplete. Recover using the release-before-rebuild artifact.'
      fi
      exit 1
    }
    trap rollback ERR
    gh release upload "$tag" installers/* --clobber
    git push origin "$GITHUB_SHA:refs/tags/$tag" --force-with-lease="refs/tags/$tag:$old_sha"
    gh release edit "$tag" --notes-file docs/RELEASE_NOTES.md --target "$GITHUB_SHA"
    gh api "$api/releases/tags/$tag" > release-backup/published.json
    python3 - <<'PY'
import hashlib,json,pathlib
release=json.loads(pathlib.Path('release-backup/published.json').read_text())
assets={a['name']:a for a in release['assets']}
for path in pathlib.Path('installers').iterdir():
    if not path.is_file(): continue
    asset=assets[path.name]
    assert asset['size']==path.stat().st_size, f'Wrong asset size: {path.name}'
    assert asset.get('digest')=='sha256:'+hashlib.sha256(path.read_bytes()).hexdigest(), f'Wrong uploaded checksum: {path.name}'
assert release['body']==pathlib.Path('docs/RELEASE_NOTES.md').read_text(), 'Release notes mismatch'
PY
    test "$(gh api "$api/git/ref/tags/$tag" --jq .object.sha)" = "$GITHUB_SHA"
    trap - ERR
    echo "Rebuilt $tag published and checksums verified."
    ;;
  *) echo 'Usage: rebuild-release.sh backup|publish' >&2; exit 2 ;;
esac
