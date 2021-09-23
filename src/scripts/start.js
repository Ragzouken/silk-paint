function windowUpdate() {
    document.documentElement.style.setProperty('--vh', `${window.innerHeight / 100}px`);
    requestAnimationFrame(windowUpdate);
}
windowUpdate();

async function start() {
    const embed = ONE("#default-save");
    const editor = new SilkPaintEditor();

    await editor.state.loadBundle(JSON.parse(embed.innerHTML));
    editor.refresh();
}
