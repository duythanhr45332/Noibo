const EventEmitter = require('events');

if (!global.DossierEventBusInstance) {
    class DossierEventBus extends EventEmitter {
        constructor() {
            super();
            this.setMaxListeners(50); // Tối đa 50 kết nối SSE đồng thời
        }
    }
    global.DossierEventBusInstance = new DossierEventBus();
}

// Singleton — dùng chung trong toàn bộ backend (Bảo đảm tuyệt đối qua global object)
module.exports = global.DossierEventBusInstance;
