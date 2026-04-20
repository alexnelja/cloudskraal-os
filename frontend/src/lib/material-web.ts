/**
 * Bootstrap file for `@material/web` custom elements.
 *
 * Imported once from main.tsx. Side-effect imports register the elements on
 * `window.customElements`; after that JSX like `<md-navigation-bar>` just works.
 *
 * Also sets typescale + brand font CSS on :host via @material/web's typography
 * utility so Lit components inherit the Cloudskraal font stack.
 */

import '@material/web/labs/navigationbar/navigation-bar.js';
import '@material/web/labs/navigationtab/navigation-tab.js';
import '@material/web/labs/navigationdrawer/navigation-drawer.js';
import '@material/web/icon/icon.js';
import '@material/web/ripple/ripple.js';
import '@material/web/focus/md-focus-ring.js';
