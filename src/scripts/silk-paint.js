// browser saves will be stored under the id "silk-paint"
const storage = new maker.ProjectStorage("silk-paint");

// type definitions for the structure of bipsi project data. useful for the
// code editor, ignored by the browser 

/**
 * @typedef {Object} SilkPaintDataDrawing
 * @property {string} id
 * @property {string} name
 * @property {string[]} frames
 * @property {Vector2} offset
 */

/**
 * @typedef {Object} SilkPaintDataObject
 * @property {string} id
 * @property {string} drawing
 * @property {Vector2} position
 */

/**
 * @typedef {Object} SilkPaintDataScene
 * @property {SilkPaintDataObject[]} objects
 */

/**
 * @typedef {Object} SilkPaintDataProject
 * @property {SilkPaintDataDrawing[]} drawings
 * @property {SilkPaintDataScene} scene
 */

/**
 * @param {SilkPaintDataProject} project
 */
function getManifest(project) {
    return project.drawings.flatMap((drawing) => drawing.frames);
}
