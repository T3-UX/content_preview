export class Frame {
    constructor(id, x, y, width, height, options, dimmer) {
        this.id = id;
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.element = document.createElement('div');
        this.element.classList.add('pce-frame');
        this.options = options;
        this.dimmer = dimmer;

        this.element.appendChild(
            this.createControls()
        )

        this.update();
    }

    createControls() {
        const div = document.createElement('div');
        div.classList.add('pce-frame-controls');

        const editButton = document.createElement('button');
        editButton.classList.add('btn', 'btn-sm', 'btn-default');
        editButton.textContent = 'Edit';

        editButton.addEventListener('click', () => {
            if (this.onClick && typeof this.onClick === 'function') {
                this.onClick(this.id);
            }
        })

        editButton.addEventListener('mouseenter', () => {
            this.controlsHover = true;
            this.dimmer.highlight(this.element);
            this.hover = true;
        })

        editButton.addEventListener('mouseleave', () => {
            this.controlsHover = false;
            this.dimmer.clear();
            this.hover = false;
        })

        div.appendChild(editButton);

        div.appendChild(
            document.createTextNode(this.id)
        );

        return div;
    }

    set hover(value) {
        if (value) {
            this.element.classList.add('pce-hover');
        } else {
            this.element.classList.remove('pce-hover');
        }
    }

    get hover() {
        return this.element.classList.contains('pce-hover');
    }

    update() {
        this.element.style = `
      top: ${this.y}px;
      left: ${this.x}px;
      width: ${this.width}px;
      height: ${this.height}px;
    `
        this.element.width = this.width;
        this.element.height = this.height;
    }
}