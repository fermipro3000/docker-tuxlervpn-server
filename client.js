const WebSocket = require("ws");

const PORT_START = 1701;
const PORT_STEP = 9001;
const CMD_SET_PROXY = "SET_PROXY";
const CMD_UNSET_PROXY = "UNSET_PROXY";
const CMD_GET_LOCAL_PROXY_ADDRESS = "getLocalProxyAddress";
const CMD_CHANGE_IP_COUNTRY_CITY = "changeIPCountryCity";
const CMD_CHANGE_IP_COUNTRY_CITY_NEW = "changeIPCountryCityNew";

let ports_web_sockets = [];
let appConnection;
let interval_;

function ParseMessage(message, ret) {
  var matches;
  var rgx = /<message>([\s\S]*)(<details>)([\s\S]*)(<\/details>)<\/message>/gm;

  if ((matches = rgx.exec(message)) !== null) {
    ret.message = matches[1];
    ret.details = matches[3];
    return true;
  }

  return false;
}

function gotMessageApp(m) {
  NewMessageApp(m);
}

function NewMessageApp(msg) {
  console.log(`[App] New Message: ${JSON.stringify(msg)}`);

  switch (msg.message) {
    case "YOUR_IP":
      App.setProxy();
      setTimeout(function () {
        App.changeIPCountryCityNew("any", "Any", false, true);
      }, 1500);
      break;
  }
}

function AppConnection(address, onclose, onsuccess, inst_id) {
  this.address = address;
  console.log(`[WS] Attempting connection to ${address}`);
  this.ws = new WebSocket(this.address);
  this.onclose_callback = onclose;
  this.onsuccess_callback = onsuccess;
  this.inst_id = inst_id;
  this.first_msg = true;
  this.was_closed = false;
  this.first_non_init = true;

  var this_ = this;
  this.cid = 0;
  this.map = {};
  this.timerID = 0;

  const connectionTimeout = setTimeout(function () {
    if (this_.ws.readyState !== WebSocket.OPEN) {
      console.log(`[WS] Connection timeout for ${address}`);
      this_.ws.terminate();
    }
  }, 10000);

  this.sendMessage = function (m, callback) {
    if (typeof callback === "undefined") callback = function (m) {};
    m = JSON.stringify(m);
    var cid = this_.cid;
    this_.cid++;
    if (typeof callback !== "undefined") this_.map[cid] = callback;
    if (this_.ws.readyState === WebSocket.OPEN) {
      this_.ws.send(cid + ":" + m);
    } else {
      console.log(`[WS] Cannot send message, socket not open: ${this_.address}`);
    }
  };

  this.ws.on("open", function () {
    clearTimeout(connectionTimeout);
    console.log(`[WS] Connected to ${this_.address}`);
    this_.ws.send("HELLO TUXLER APP");
  });

  this.ws.on("message", function (data) {
    var received_msg = data.toString();

    if (this_.first_msg) {
      this_.first_msg = false;

      if (received_msg === "WELCOME TO TUXLER APP") {
        console.log(`[WS] Welcome received from ${this_.address}`);
        if (typeof this_.onsuccess_callback !== "undefined")
          this_.onsuccess_callback(this_);
      } else {
        console.log(`[WS] Unexpected welcome message: ${received_msg}`);
        this_.ws.close();
      }
    } else {
      var idx;

      if ((idx = received_msg.indexOf(":")) === -1) {
        console.log(`[WS] Invalid message format: ${received_msg}`);
        this_.ws.close();
      } else {
        var cid = parseInt(received_msg.substring(0, idx));
        received_msg = received_msg.substring(idx + 1);

        if (cid in this_.map) {
          var exc = false;
          var json;

          try {
            json = JSON.parse(received_msg);
          } catch (e) {
            exc = true;
          }

          if (typeof json === "undefined") exc = true;
          else {
            for (var key in json) {
              if (json[key] === "undefined") json[key] = undefined;
            }
          }
          this_.map[cid](exc ? received_msg : json);
        } else {
          var ret = {};
          if (ParseMessage(received_msg, ret)) gotMessageApp(ret);
        }
      }
    }
  });

  this.ws.on("error", function (err) {
    console.error(`[WS] Error on ${this_.address}: ${err.message}`);
  });

  this.ws.on("close", function () {
    if (!this_.was_closed) {
      this_.was_closed = true;
      console.log(`[WS] Connection closed: ${this_.address}`);
      if (typeof this_.onclose_callback !== "undefined")
        this_.onclose_callback(this_.inst_id);
    }
  });
}

function startWebSocket() {
  var current_instances = ports_web_sockets.length;
  var instances = {};

  const onclose = function (i) {
    instances[i] = undefined;
    current_instances--;

    if (current_instances === 0) {
      console.log("[WS] All connections closed, retrying in 5 seconds...");
      setTimeout(function () {
        startWebSocket();
      }, 5000);
    }
  };

  const onsuccess = function (instance) {
    console.log(`[WS] Initializing App on ${instance.address}`);
    appConnection = instance;

    App.setProxy();
    App.changeIPCountryCityNew("any", "Any", false, true);
  };

  for (let i = 0; i < ports_web_sockets.length; i++) {
    instances[i] = new AppConnection(
      "ws://127.0.0.1:" + ports_web_sockets[i] + "/tuxler",
      onclose,
      onsuccess,
      i
    );
  }
}

const App = new (class {
  constructor() {
    this._initPorts();
  }

  _initPorts() {
    let port = parseInt(process.env.TUXLER_PORT_START) || PORT_START;
    const step = parseInt(process.env.TUXLER_PORT_STEP) || PORT_STEP;
    const max_port = 65000;

    while (port < max_port) {
      if (port !== 12347 && port !== 23321 && port !== 23320) {
        ports_web_sockets.push(port);
      }
      port += step;
    }
    console.log(`[App] Initialized with ports: ${ports_web_sockets.join(", ")}`);
  }

  setProxy() {
    console.log(`[App] Sending command: ${CMD_SET_PROXY}`);
    this.sendMessage(CMD_SET_PROXY);
  }

  unsetProxy() {
    console.log(`[App] Sending command: ${CMD_UNSET_PROXY}`);
    this.sendMessage(CMD_UNSET_PROXY);
  }

  changeIPCountryCityNew(countryISO, city, next_nearby, is_residential) {
    const args = JSON.stringify([
      countryISO,
      city,
      next_nearby,
      is_residential,
    ]);
    console.log(`[App] Sending command: ${CMD_CHANGE_IP_COUNTRY_CITY_NEW} with args: ${args}`);
    this.sendMessage({
      name: CMD_CHANGE_IP_COUNTRY_CITY_NEW,
      args,
    });
  }

  sendMessage(m, callback) {
    if (!callback) {
      callback = function (resp) {};
    }

    if (!appConnection) {
        console.error("[App] Cannot send message: No active connection");
        return false;
    }

    let exception = false;
    try {
      appConnection.sendMessage(m, callback);
    } catch (exc) {
      console.error(`[App] Exception in sendMessage: ${exc.message}`);
      exception = true;
    }

    return !exception;
  }
})();

startWebSocket();
