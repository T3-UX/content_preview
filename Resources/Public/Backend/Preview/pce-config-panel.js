class PceConfigPanel extends HTMLElement {
    options = {
      'always-show-links': {
        checked: false,
        label: 'Always show links',
      },
      'dim-inactive': {
        checked: true,
        label: 'Dim inactive targets',
      },
      'show-outline-on-link-hover': {
        checked: true,
        label: 'Show outline on link hover',
      },
      'show-outline-on-target-hover': {
        checked: false,
        label: 'Show outline on target hover',
      },
      'always-show-outline': {
        checked: false,
        label: 'Always show outlines',
      },
      'show-location-indicators': {
        checked: true,
        label: 'Show location indicators',
      },
      'navigate-pages-in-typo3': {
        checked: false,
        label: 'Navigate pages in TYPO3',
      }
    }

    saveState() {
      const entries = Object.entries(this.options).map(([optionId, { checked }]) => [optionId, checked])
      const obj = Object.fromEntries(entries);
      localStorage.setItem('pce-options', JSON.stringify(obj));
    }

    loadState() {
      try {
        const str = localStorage.getItem('pce-options');
        if (!str) return;

        const obj = JSON.parse(str);

        Object.entries(obj).forEach(([optionId, checked]) => {
          this.options[optionId].checked = checked ?? this.options[optionId].checked
        })
      } catch {}
    }

    constructor() {
      super();
    }

    connectedCallback() {
      this.classList.add('pce-config-panel');

      this.loadState();
      this.render()
    }

    setOption(optionId, checked) {
      const attribute = `data-pce-${optionId}`;
      this.options[optionId].checked = checked;

      if (checked) {
        document.body.setAttribute(attribute, '1');
      } else {
        document.body.removeAttribute(attribute);
      }

      this.saveState();
    }

    render() {
      this.innerHTML = ``;
      const optionsWrapper = document.createElement('div');
      const optionsList = document.createElement('ul');
      optionsWrapper.appendChild(optionsList)

      const openButton = document.createElement('button');
      openButton.classList.add('pce-config-panel-toggle');
      openButton.innerHTML = '⚙';
      openButton.addEventListener('click', () => {
        const isOpen = this.getAttribute('data-open');

        if (isOpen === '1') {
          this.removeAttribute('data-open');
        } else {
          this.setAttribute('data-open', '1');
        }
      })

      this.append(openButton);

      Object.entries(this.options).forEach(([optionId, option]) => {
        const label = document.createElement('label');
        const text = document.createTextNode(option.label);
        const input = document.createElement('input');
        input.type = 'checkbox';
        input.checked = option.checked;

        input.addEventListener('change', () => {
          this.setOption(optionId, input.checked);
        });
        this.setOption(optionId, input.checked);

        label.appendChild(input);
        label.appendChild(text);

        const li = document.createElement('li');
        li.appendChild(label);

        optionsList.appendChild(li);
      })

      this.append(optionsWrapper);
    }
  }

  customElements.define("pce-config-panel", PceConfigPanel);
