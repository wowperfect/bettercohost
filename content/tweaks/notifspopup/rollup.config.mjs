import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import { babel } from '@rollup/plugin-babel';
import postcss from 'rollup-plugin-postcss';

const VERSION = 16;

const banner = `// ==UserScript==
// @name        Cohost Notification Popover
// @version     ${VERSION}
// @updateURL   https://cloudwithlightning.net/random/chostin/conotifpopover.js
// @downloadURL https://cloudwithlightning.net/random/chostin/conotifpopover.js
// @match       https://cohost.org/*
// @author      https://cohost.org/blep
// @description adds a lil notification popover!!!
// ==/UserScript==


/*
# Changelog
## v16
- fix incorrect sorting of grouped shares

## v15
- fix extra elements appearing at the end of the document

## v14
- fixes for new cohost theme

## v13
- fix audio attachments
- don’t open the popover if a modifier key is held
- minor other stuff

## v12
- accessibility improvements

## v11
- fix glitch when posts were deleted

## v10
- fix notifications not being sorted correctly sometimes
- fix some glitches in the Wheels of Time™
- minor style fixes

## v9
- add feature to load colors from the current theme

## v8
- fixed fetch() url construction not working sometimes
- made fetch errors look nicer
- fixed broken scrolling in firefox
- fixed overflow in notification content line

## v7
- complete rewrite
*/

`;

export default {
    input: 'src/index.jsx',
    plugins: [
        resolve({ preferBuiltins: false }),
        commonjs(),
        babel({
            babelHelpers: 'bundled',
            plugins: [
                [
                    '@babel/plugin-transform-react-jsx',
                    {
                        runtime: 'automatic',
                        importSource: 'preact',
                    },
                ],
            ],
        }),
        postcss({ extract: false, inject: true }),
    ],
    output: {
        file: 'dist/conotifpopover.js',
        format: 'esm',
        banner,
    },
};
