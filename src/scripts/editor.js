class SceneObjectView {
    /**
     * @param {SilkPaintEditor} editor 
     */
    constructor(editor) {
        this.editor = editor;
        this.rendering = createRendering2D(128, 128);
        this.root = this.rendering.canvas;

        this.editor.sceneElement.append(this.root);

        this.root.addEventListener("pointerdown", (event) => {
            event.stopPropagation();
            event.preventDefault();
        });
    }

    /**
     * @param {SilkPaintDataObject} object
     */
    refresh(object) {
        const drawing = this.editor.state.present.drawings.find((drawing) => drawing.id === object.drawing);
        const rendering = this.editor.state.resources.get(drawing.frames[0]);

        copyRendering2D(rendering, this.rendering);
        setElementTransform(this.root, translationMatrix(object.position));
    }

    dispose() {
        this.root.remove();
    }
}

class SilkPaintEditor {
    constructor() {
        this.state = new maker.StateManager(getManifest);

        this.viewportElement = ONE("#viewport");
        this.sceneElement = ONE("#scene");
        this.frameElement = ONE("#frame");

        const rendering = createRendering2D(128, 128);
        this.sceneElement.append(rendering.canvas);

        this.panning = new PanningScene(this.sceneElement);
        this.panning.frameRect({ x: 0, y: 0, width: 128, height: 128 }, { maxScale: 8, bounds: this.frameElement.getBoundingClientRect() });

        this.sceneObjectPool = new IndexedItemPool({
            create: () => new SceneObjectView(this),
            dispose: (item) => item.dispose(),
        });
    }

    refresh() {
        const project = this.state.present;
     
        this.sceneObjectPool.map(project.scene.objects, (object, item) => {
            item.refresh(object);
        });
    }
}

class PanningScene {
    get hidden() { return this.container.hidden; }
    set hidden(value) { this.container.hidden = value; }

    /**
     * @param {HTMLElement} container 
     */
    constructor(container) {
        this.viewport = container.parentElement;
        this.container = container;
        this.transform = new DOMMatrix();
        this.locked = false;

        

        this.pointerA = undefined;
        this.pointerB = undefined;
        let ratio = 1;

        this.viewport.addEventListener("pointerdown", (event) => {
            if (this.hidden || this.locked) return;
            event.stopPropagation();
            event.preventDefault();

            if (!this.pointerA) {
                // determine and save the relationship between mouse and scene
                // G = M1^ . S (scene relative to mouse)
                const mouse = this.mouseEventToViewportTransform(event);
                const grab = mouse.invertSelf().multiplySelf(this.transform);
                document.body.style.setProperty("cursor", "grabbing");
                this.viewport.style.setProperty("cursor", "grabbing");
                this.container.classList.toggle("skip-transition", true);

                ratio = 1;

                const drag = ui.drag(event);
                drag.addEventListener("move", (event) => {
                    // preserve the relationship between mouse and scene
                    // D2 = M2 . G (drawing relative to scene)
                    const mouse = this.mouseEventToViewportTransform(event.detail);
                    mouse.scaleSelf(ratio, ratio);
                    this.transform = mouse.multiply(grab);
                    this.refresh();
                });
                drag.addEventListener("up", (event) => {
                    document.body.style.removeProperty("cursor");
                    this.viewport.style.removeProperty("cursor");
                    this.container.classList.toggle("skip-transition", false);

                    if (this.pointerB) this.pointerB.unlisten();

                    this.pointerA = undefined;
                    this.pointerB = undefined;
                });

                this.pointerA = drag;
            } else if (!this.pointerB) {
                const mouseB = this.mouseEventToViewportTransform(event.detail);
                const mouseA = this.mouseEventToViewportTransform(this.pointerA.lastEvent);
                const dx = mouseB.e - mouseA.e;
                const dy = mouseB.f - mouseA.f;
                const initialD = Math.sqrt(dx*dx + dy*dy); 

                this.pointerB = ui.drag(event);
                this.pointerB.addEventListener("move", (event) => {
                    const mouseB = this.mouseEventToViewportTransform(event.detail);
                    const mouseA = this.mouseEventToViewportTransform(this.pointerA.lastEvent);
                    const dx = mouseB.e - mouseA.e;
                    const dy = mouseB.f - mouseA.f;
                    const currentD = Math.sqrt(dx*dx + dy*dy);
                    ratio = currentD / initialD;
                });
                this.pointerB.addEventListener("up", () => {
                    this.pointerB = undefined;
                });
            }
        });
        
        this.viewport.addEventListener('wheel', (event) => {
            if (this.hidden || this.locked) return;

            event.preventDefault();

            const mouse = this.mouseEventToViewportTransform(event);
            const origin = (this.transform.inverse().multiply(mouse)).transformPoint();

            const deltaY = event.deltaMode === 0 ? event.deltaY : event.deltaY * 33;

            const [minScale, maxScale] = [.25, 8];
            const prevScale = getMatrixScale(this.transform).x;
            const [minDelta, maxDelta] = [minScale/prevScale, maxScale/prevScale];
            const magnitude = Math.min(Math.abs(deltaY), 25);
            const exponent = Math.sign(deltaY) * magnitude * -.01;
            const deltaScale = clamp(Math.pow(2, exponent), minDelta, maxDelta);

            // prev * delta <= max -> delta <= max/prev
            this.transform.scaleSelf(
                deltaScale, deltaScale, deltaScale,
                origin.x, origin.y, origin.z,
            );

            ratio *= deltaScale;
            this.refresh();
        });

        this.refresh();
    }

    refresh() {
        setElementTransform(this.container, this.transform);
    }

    frameRect(rect, { minScale=.25, maxScale=2, bounds=undefined } = {}) {
        bounds = bounds ?? this.viewport.getBoundingClientRect();

        console.log(bounds)

        // find scale that contains all width, all height, and is within limits
        const sx = bounds.width / rect.width;
        const sy = bounds.height / rect.height;
        const scale = clamp(Math.min(sx, sy), minScale, maxScale);

        // find translation that centers the rect in the viewport
        const ex = (1/scale - 1/sx) * bounds.width * .5;
        const ey = (1/scale - 1/sy) * bounds.height * .5;
        const [ox, oy] = [-rect.x + ex, -rect.y + ey];

        this.transform = new DOMMatrix();
        this.transform.scaleSelf(scale, scale);
        this.transform.translateSelf(ox, oy);
        this.refresh();
    }

    mouseEventToViewportTransform(event) {
        const rect = this.viewport.getBoundingClientRect();
        const [sx, sy] = [event.clientX - rect.x, event.clientY - rect.y];
        const matrix = (new DOMMatrixReadOnly()).translate(sx, sy);
        return matrix;
    }

    mouseEventToSceneTransform(event) {
        const mouse = this.mouseEventToViewportTransform(event);
        mouse.preMultiplySelf(this.transform.inverse());
        return mouse;
    }
}
