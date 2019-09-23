//@ts-check

export default class Mouse {
    /**
     * 
     * @param {HTMLElement} element 
     */
    constructor(element) {
        this.x = 0;
        this.y = 0;
        this._x = 0;
        this._y = 0;

        /**
         * 
         * @param {MouseEvent} e 
         */
        const setMousePos = (e) => {
            const rect = element.getBoundingClientRect();
            this._x = e.clientX - rect.left;
            this._y = e.clientY - rect.top;
        }

        element.addEventListener('mousemove', (e) => {
            setMousePos(e);
        });
        element.addEventListener('mousedown', (e) => {
            setMousePos(e);
            //console.log(`x: ${this._x}, y:${this._y}`);
        });
    }
    update() {
        this.x = this._x;
        this.y = this._y;
    }
}