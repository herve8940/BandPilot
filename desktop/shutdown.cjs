// Electron can receive another quit request while an earlier one is still pending.
function registerShutdown(app, {stopMeasurements, installUpdate, diagnostic}) {
  let pending = false;
  async function finish() {
    try {
      await stopMeasurements();
    } catch (error) {
      diagnostic('desktop.measurement_shutdown_error', {message:String(error)});
    }
    try {
      await installUpdate();
    } catch (error) {
      diagnostic('desktop.update_install_error', {message:String(error)});
    }
  }
  function onQuit(event) {
    event.preventDefault();
    if (pending) return;
    pending = true;
    void finish().finally(() => {
      app.off('before-quit', onQuit);
      app.quit();
    });
  }
  app.on('before-quit', onQuit);
}
module.exports = {registerShutdown};
