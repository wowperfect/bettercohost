// support cohost theme userstyles by extracting their colors
function loadThemeVariables(target) {
    let isLight = false;
    const dataTheme = document.querySelector('[data-theme]')?.dataset?.theme;
    if (dataTheme === 'both') {
        isLight = window.matchMedia('(prefers-color-scheme: light)').matches;
    } else {
        isLight = dataTheme === 'light';
    }

    const getColor = (tree, prop) => {
        const inner = document.createElement('div');
        target.appendChild(inner);

        let cursor = inner;
        for (const itemSel of tree) {
            if (typeof itemSel === 'string') {
                const parts = itemSel.split('.');
                const element = parts.shift() || 'div';
                const node = document.createElement(element);
                if (cursor === inner) node.dataset.theme = isLight ? 'light' : 'dark';
                cursor.appendChild(node);
                node.className = parts.join(' ');
                cursor = node;
            } else {
                cursor = itemSel(cursor);
            }
        }

        let value = getComputedStyle(cursor)[prop];
        target.removeChild(inner);

        let m;
        if ((m = value.match(/rgba\(\s*(\d+),\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/))) {
            return `${m[1]} ${m[2]} ${m[3]}`;
        }
        if ((m = value.match(/rgb\(\s*(\d+),\s*(\d+),\s*(\d+)\s*\)/))) {
            return `${m[1]} ${m[2]} ${m[3]}`;
        }

        return null;
    };

    const COLORS = {
        '--np-header-button-bg': [
            ['.co-themed-box.co-themed-box', (n) => {
                n.innerHTML = '<input type="checkbox" />';
                return n.children[0];
            }],
            'border-color',
        ],
        '--np-header-button-fg': [
            ['.co-themed-box.co-themed-box', (n) => {
                n.innerHTML = '<input type="checkbox" />';
                return n.children[0];
            }],
            'background-color',
        ],
        '--np-open-link-fg': [
            ['.co-themed-box.co-notification-group', 'header'],
            'color',
        ],

        '--np-quote-border': [
            ['.co-themed-box.co-notification-group', '.co-notification-card', '.co-block-quote'],
            'border-color',
        ],
        '--np-notif-bg': [
            ['.co-themed-box.co-notification-group'],
            'background-color',
        ],
        '--np-notif-fg': [
            ['.co-themed-box.co-notification-group'],
            'color',
        ],
        '--np-notif-divider': [
            ['.co-themed-box.co-notification-group.divide-y', (node) => {
                node.innerHTML = '<div></div><div></div>';
                return node.children[1];
            }],
            'border-color',
        ],
        '--np-notif-target-fg': [
            ['.co-themed-box.co-notification-group', '.co-notification-card', '.co-inline-quote'],
            'color',
        ],
        '--np-attachment-bg': [['.bg-cherry'], 'background-color'],
        '--np-attachment-fg': [['.text-notWhite'], 'color'],

        '--np-date-header': [
            ['.co-themed-box.co-notification-group', 'header'],
            'background-color',
        ],
        '--np-date-header-fg': [
            ['.co-themed-box.co-notification-group', 'header'],
            'color',
        ],

        '--np-popover-bg': [
            ['.co-themed-box.co-notification-group'],
            'background-color',
        ],
        '--np-popover-fg': [
            ['.co-themed-box.co-notification-group'],
            'color',
        ],
        '--np-popover-outline': () => {
            if (isLight) return 'var(--np-popover-outline--light)';
            else return 'var(--np-popover-outline--dark)';
        },

        '--np-button-bg': [['.bg-foreground'], 'background-color'],
        '--np-button-active-bg': [
            [(n) => {
                const test = document.createElement('div');
                n.appendChild(test);
                test.className = 'ui-open:bg-foreground-700';
                test.dataset.headlessuiState = 'open';
                return test;
            }],
            'background-color',
        ],
        '--np-button-fg': [['.text-text'], 'color'],
    };

    for (const [k, v] of Object.entries(COLORS)) {
        if (typeof v === 'function') {
            target.style.setProperty(k, v());
        } else {
            const color = getColor(...v);
            if (color) {
                target.style.setProperty(k, color);
            }
        }
    }
}

let themeLoaderTarget;
export const themeLoader = {
    init(target) {
        themeLoaderTarget = target;

        window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
            this.update();
        });
    },
    update() {
        loadThemeVariables(themeLoaderTarget);
    },
};
