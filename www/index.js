import '/src/define.ts';

const pickerContainer = document.querySelector('.colora-container');
const themeContainer = document.querySelector('.theme-container');

const swatches = [
    'rgb(244 67 54)',
    'rgb(233 30 99 / 0.95)',
    'rgb(156 39 176 / 0.9)',
    'rgb(103 58 183 / 0.85)',
    'rgb(63 81 181 / 0.8)',
    'rgb(33 150 243 / 0.75)',
    'rgb(3 169 244 / 0.7)',
    'rgb(0 188 212 / 0.7)',
    'rgb(0 150 136 / 0.75)',
    'rgb(76 175 80 / 0.8)',
    'rgb(139 195 74 / 0.85)',
    'rgb(205 220 57 / 0.9)',
    'rgb(255 235 59 / 0.95)',
    'rgb(255 193 7)'
];

const themes = {
    classic: {swatches, formats: 'hex rgb hsl oklch'},
    monolith: {swatches: swatches.slice(0, 7), formats: 'hex'},
    nano: {swatches: swatches.slice(0, 7), formats: 'hex'}
};

const buttons = [];

for (const [theme, {swatches, formats}] of Object.entries(themes)) {
    const button = document.createElement('button');
    button.textContent = theme;
    buttons.push(button);

    button.addEventListener('click', () => {
        for (const btn of buttons) {
            btn.classList.toggle('active', btn === button);
        }

        const picker = document.createElement('colora-picker');
        picker.setAttribute('popup', '');
        picker.setAttribute('theme', theme);
        picker.setAttribute('formats', formats);
        picker.setAttribute('buttons', 'clear save');
        picker.setAttribute('value', '#ff0000');
        picker.swatches = swatches;

        for (const type of ['input', 'change', 'cancel', 'open', 'close']) {
            picker.addEventListener(type, () => console.log(`Event: "${type}"`, {value: picker.value, current: picker.currentValue}));
        }

        pickerContainer.replaceChildren(picker);
    });

    themeContainer.appendChild(button);
}

buttons[0].click();
