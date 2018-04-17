// Former read_vars.js



function getAllUrlParams(url) {
  /**
   * Parse all parameters delivered with the URL and return a dictionary with the parsed parameters.
   */

  // Get query string from url (optional) or window
  var queryString = url ? url.split('?')[1] : window.location.search.slice(1);

  // We will store the parameters here
  var obj = {};

  // If query string exists
  if (queryString) {

  // stuff after # is not part of query string, so get rid of it
  queryString = queryString.split('#')[0];

  // split our query string into its component parts
  var arr = queryString.split('&');

  for (var i=0; i<arr.length; i++) {
    // separate the keys and the values
    var a = arr[i].split('=');

    // in case params look like: list[]=thing1&list[]=thing2
    var paramNum = undefined;
    var paramName = a[0].replace(/\[\d*\]/, function(v) {
    paramNum = v.slice(1,-1);
    return '';
    });

    // set parameter value (use 'true' if empty)
    var paramValue = typeof(a[1])==='undefined' ? true : a[1];

    // if parameter name already exists
    if (obj[paramName]) {
    // convert value to array (if still string)
    if (typeof obj[paramName] === 'string') {
      obj[paramName] = [obj[paramName]];
    }
    // if no array index number specified...
    if (typeof paramNum === 'undefined') {
      // put the value on the end of the array
      obj[paramName].push(paramValue);
    }
    // if array index number specified...
    else {
      // put the value at that index number
      obj[paramName][paramNum] = paramValue;
    }
    }
    // if param name doesn't exist yet, set it
    else {
    obj[paramName] = paramValue;
    }
  }
  }

  return obj;
}

function retrieveTagByID(tag){
  /**
   * Retrieve a tag by its ID.
   */
  tags.retrieveTag(tag);
}

function onCallSuccess (res, callback) {
  /**
   * Called upon the success of a common Crossbar/NA call.
   */
  callback = callback || function(x) {return null;};
  if(typeof res == 'object'){
  if ('error' in res) {
    Notify(res['error']['message'],null,null,'danger')
    $("body").trigger('demoproceed', ['error']);
    return;
  } else if('success' in res) {
    if('info' in res['success'])
    Notify(res['success']['info']);
    if('data' in res['success']){
    data = {'ffbo_json': res['success']['data'],
      'type': 'morphology_json'};
    processFFBOjson(data);
    }
    callback(res);
  }
  }
  $("#search-wrapper").unblock();
  $("body").trigger('demoproceed', ['success']);
};

function onCallError(err) {
  /**
   * Called upon the raising of an error during a common Crossbar/NA call.
   */
  console.log(err)
  Notify(err,null,null,'danger');
  $("body").trigger('demoproceed', ['error']);
  $("#search-wrapper").unblock();
}

function onCallProgress(progress) {
  /**
   * Called upon the progress of a common Crossbar/NA call.
   */
  data = {'ffbo_json': progress,'type': 'morphology_json'};
  processFFBOjson(data);
}

function retrieveNeuronByID(key_type, key, session) {
  /**
   * Hook into the Information panel to retieve individual neuron information from NA.
   */

  msg = {}
  msg['username'] = username;
  msg['servers'] = {}
  msg['data_callback_uri'] = 'ffbo.ui.receive_partial'

  msg['task'] = {}
  msg['task']['key_type'] = key_type;
  msg['task']['key'] = key;

  var na_servers = document.getElementById("na_servers");

  try {
  msg['servers']['na'] = na_servers.options[na_servers.selectedIndex].value;
  } catch (err) {
  console.log("na server not valid")
  UI.Notify("Unable to contact Neuroarch server" ,null,null,'danger')

  return;
  }

  session.call('ffbo.processor.request_by_id', [msg], {}, {receive_progress: true}).then(onCallSuccess,onCallError,onCallProgress);
}

function retrieveByID(key_type,key,session){
  /** 
   * Retrieve tags or neuron information from NA, depending in the key_type chosen.
  */
  var valid_key_types = {'na':true,'vfb':true,'tag':true};

  if (key_type in valid_key_types){

  if (key_type=='tag'){
    retrieveTagByID(key)
  } else {
    retrieveNeuronByID(key_type,key,session)
  }
  }else{
  ui.Notify("Invalid key type " + key_type ,null,null,'danger')
  }
}

// Former connection.js

// Define a number of user-related global variables, allowing messages to be sent externally.

function ClientSession() {
  /**
   * This is the ClientSession object that holds client session
   */
  this.client_session;
  this.user;
  this.morphology_store = {};
  this.username;

  this.local_url = "wss://neuronlp.fruitflybrain.org:9050/ws";
  this.server_url = "ws://127.0.0.1:8080/ws";

  this.wsuri = '';
  if (document.location.origin == "file://") {
    this.wsuri = this.server_url;
  } else {
    this.wsuri = this.local_url;
  }

  this.connection;
  this.login_success = false;
  window.login_success = this.login_success;
  this.direct_access = false;
  window.direct_access = this.direct_access;

  this.params = getAllUrlParams();
  keys = Object.keys(this.params);
  if (keys.length > 0) {
    this.direct_access = true;
    window.direct_access = true;
  }

  function constructQuery(session) {
    /**
     * Prepares a query to send to NA.
     */
    msg = {};
    msg["username"] = username;
    msg["servers"] = {};
    msg["data_callback_uri"] = "ffbo.ui.receive_partial";
    msg["threshold"] = 20;
    if (ffbomesh.neurons_3d) msg["threshold"] = 1;

    var language_selector = document.getElementById("query_language");
    msg["language"] = language_selector.options[language_selector.selectedIndex].value;

    var nlp_servers = document.getElementById("nlp_servers");
    var na_servers = document.getElementById("na_servers");

    try {
      msg["servers"]["nlp"] = nlp_servers.options[nlp_servers.selectedIndex].value;
    } catch (err) {
      console.log("nlp server not valid");
      return;
    }

    try {
      msg["servers"]["na"] = na_servers.options[na_servers.selectedIndex].value;
    } catch (err) {
      console.log("na server not valid");
      return;
    }

    msg["nlp_query"] = document.getElementById("srch_box").value;
    return msg;
  }
  
  this.sendQuery = function() {
    /**
     * Sends a query to NA.
     */
    var msg = constructQuery(client_session);
    if (typeof msg === "undefined") {
      Notify("Server List is not Complete", null, null, "danger");
      $("#search-wrapper").unblock();
      $("body").trigger("demoproceed", ["error"]);
    } else {
      client_session.call("ffbo.processor.nlp_to_visualise",[msg],{},{ receive_progress: true }).then(onCallSuccess, onCallError, onCallProgress);
    }
  }



  this.sendStandardNA = function(msg, call, callback) {
    /**
     * Sends a standard command to NA; allows for custom callbacks and calls.
     */
    var na_servers = document.getElementById("na_servers");
    var na_server = na_servers.options[na_servers.selectedIndex].value;
    call = call || "ffbo.na.query." + na_server;
    callback = callback || null;
    var onStandardCallSuccess = function(x) {
      return onCallSuccess(x, callback);
    }
    msg["username"] = username;
    client_session.call(call, [msg], {}).then(onStandardCallSuccess, onCallError);
  }

  // Functions to interact with NA directly:

  this.getConnectivityData = function() {
    /**
     * Receives and processes connectivity data.
     */
    msg = {};
    msg["format"] = "nx"; // Format can be one of 'morphology', 'na','no_result', 'df', 'nk' or 'get_data'. Defaults to morphology
    msg["query"] = [
      {
        action: { method: { add_connecting_synapses: {} } },
        object: { state: 0 }
      }
    ];
    msg["temp"] = true;
    $(".overlay-background").show();
    Notify("Fetching connectivity data");
    sendStandardNA(msg, "ffbo.processor.neuroarch_query", function(res) {$(".overlay-background").hide(); Notify("Finished fetching connectivity data."); process_connectivity_data(res);});
    // Setting 'temp': true won't append results to the state memory, keeping front end interactions independent of this query
    // Passing keyword args to a method would be done something like this 'add_connecting_synapses': {'include_inferred': false}
    // Memory can be used to refer to intermediate results. For example, the following is the translation of show neurons in eb
    // msg['query'] = [{'action': {'method': {'query': {}}}, 'object': {'class': 'Neuropil'}},   // ALL neuropils
    //{'action': {'method': {'has': {'name': 'EB'}}}, 'object': {'memory': 0}},// ALL neuropils => has name eb
    //  {'action': {'method': {'traverse_owns': {'cls': 'Neuron'}}}, 'object': {'memory': 0}}] // eb => traverse for neurons
  }

  this.addByUname = function(uname) {
    /**
     * Adds a neuron by its name.
     */
    msg = {
      format: "morphology",
      data_callback_uri: "ffbo.ui.receive_partial",
      verb: "add",
      query: [
        {
          action: { method: { query: { uname: uname } } },
          object: { class: "Neuron" }
        }
      ]
    };
    sendStandardNA(msg);
  }

  this.removeByUname = function(uname) {
    /**
     * Removes a neuron by its name.
     */
    msg = {
      format: "morphology",
      data_callback_uri: "ffbo.ui.receive_partial",
      verb: "remove",
      query: [
        {
          action: { method: { query: { uname: uname } } },
          object: { class: "Neuron" }
        }
      ]
    };
    sendStandardNA(msg);
  }

  this.addSynapseByUname = function(uname) {
    /**
     * Adds a synapse by its name.
     */
    msg = {
      format: "morphology",
      data_callback_uri: "ffbo.ui.receive_partial",
      verb: "add",
      query: [
        {
          action: { method: { query: { uname: uname } } },
          object: { class: "Synapse" }
        }
      ]
    };
    sendStandardNA(msg);
  }

  this.removeSynapseByUname = function(uname) {
    /**
     * Removes a synapse by its name.
     */
    msg = {
      format: "morphology",
      data_callback_uri: "ffbo.ui.receive_partial",
      verb: "remove",
      query: [
        {
          action: { method: { query: { uname: uname } } },
          object: { class: "Synapse" }
        }
      ]
    };
    sendStandardNA(msg);
  }

  // Start Connection

  this.startConnection = function(authid, key) {
    // the WAMP connection to the Router
    //
    function onchallenge(session, method, extra) {
      if (method === "wampcra") {
        salted_key = autobahn.auth_cra.derive_key(
          key,
          extra.salt,
          extra.iterations,
          extra.keylen
        );
        if (key == "guestpass" && authid == "guest") {
          salted_key = "C5/c598Gme4oALjmdhVC2H25OQPK0M2/tu8yrHpyghA=";
        }
        return autobahn.auth_cra.sign(salted_key, extra.challenge);
      }
    }
    connection = new autobahn.Connection({
      url: this.wsuri,
      realm: "realm1",
      authmethods: ["wampcra"],
      authid: authid,
      onchallenge: onchallenge
    });

    connection.onopen = function(session, details) {
      console.log("Connected to FFBO");
      client_session = session;
      user = session.id;
      username = details.authid;
      // get feedback element
      var feedback = document.getElementById("auth_feedback");
      feedback.innerHTML = "Welcome " + username + "!";
      feedback.style.color = "green";
      if (window.login_success == false) {
        if (!window.direct_access) {
        } else {
          $.unblockUI();
          //$("#welcomepage").hide();
        }
      }
      window.login_success = true;

      // Start registering procedures for remote calls.

      function receivePartialDatabase(args) {
        /**
         * Receive a section of the morphology database
         */
        data = { ffbo_json: args[0], type: "morphology_json" };
        if (!$.isEmptyObject(metadata)) {
          for (var key in data["ffbo_json"]) {
            if (key in metadata["color"]) {
              var color = metadata["color"][key];
              data["ffbo_json"][key]["color"] = new THREE.Color(
                color[0],
                color[1],
                color[2]
              );
            }
          }
        }
        processFFBOjson(data);
        return true;
      }

      session.register("ffbo.ui.receive_partial." + session.id,receivePartialDatabase).then(
          function(reg) {},
          function(err) {
            console.log("Failed to register procedure ffbo.ui.recieve_partial." + session.id,err);
          }
        );

      function receiveMessage(args) {
        if ("info" in args[0]) {
          if ("error" in args[0]["info"]) {
            Notify(args[0]["info"]["error"], null, null, "danger");
            $("body").trigger("demoproceed", ["error"]);
            $("#search-wrapper").unblock();
          } else if ("success" in args[0]["info"]) {
            Notify(args[0]["info"]["success"]);
          }
        }
        if ("commands" in args[0]) {
          if ("reset" in args[0]["commands"]) {
            neuList = [];
            ffbomesh.reset();
            resetNeuronButton();
            $("#neu-id").attr("name", "");
            $("#neu-id").attr("uid", "");
            $("#neu-id").text("FlyCircuit DB: ");
            $("#flycircuit-iframe").attr("src", "");
            delete args[0]["commands"]["reset"];
          }
          if ("remove" in args[0]["commands"]) {
            ids = args[0]["commands"]["remove"][0];
            for (var i = 0; i < ids.length; ++i) {
              ind = neuList.indexOf(ids[i]);
              $("#li-btn-" + uidDecode(ids[i])).remove();
              try {
                $("#btn-keep-" + uidDecode(ids[i])).remove();
              } catch (e) {}
              if (ind > -1) neuList.splice(ind, 1);
            }
          }
          for (var cmd in args[0]["commands"]) {
            try {
            } catch (err) {}
            ffbomesh.addCommand({
              commands: [cmd],
              neurons: args[0]["commands"][cmd][0],
              args: args[0]["commands"][cmd][1]
            });
          }
          try {
            if (synaptic_info && last_click) {
              if (last_click in ffbomesh.meshDict) {
                d = [ffbomesh.meshDict[last_click].name, last_click];
                fetchDetailInfo(d);
              }
            }
          } finally {
            ffbomesh.updateInfoPanel();
          }
        }
      }

      session.register("ffbo.ui.receive_msg." + session.id, receiveMessage).then(
          function(reg) {},
          function(err) {
            console.log("failed to register procedure ffbo.ui.receive_msg." + session.id, err);
          }
        );

      // SUBSCRIBE to topics and receive events.

      function onServerUpdate(args) {
        var directory = args[0];
        populate_server_lists(directory);
      }

      session.subscribe("ffbo.server.update", onServerUpdate).then(
        function(sub) {},
        function(err) {
          console.log("failed to subscribe to server update", err);
        }
      );

      // SUBSCRIBE to dynamic UI updates from the processor:

      function onUIUpdate(args) {
        var info = args[0];
        Notify(info, null, null, "danger");
      }

      session.subscribe("ffbo.ui.update." + session.id, onUIUpdate).then(
        function(sub) {},
        function(err) {
          console.log("failed to subscribe to ui update", err);
        }
      );

      session.call("ffbo.processor.server_information").then(
        function(res) {
          populate_server_lists(res);
          params = getAllUrlParams();
          keys = Object.keys(params);
          if ("mode" in params && params.mode == "3d") {
            if (!ffbomesh.neurons_3d) $("#3d_rendering")[0].click();
          }
          if ("bp_strength" in params) {
            val = params["bp_strength"];
            $("#bloomstrength").bootstrapSlider("setValue", val);
            ffbomesh.bloomPass.strength = val;
          }

          if ("tag" in params) {
            $("#btn-info-pin").click();
            retrieve_tag(params["tag"]);
          } else if ("na" in params) {
            retrieve_neuron_by_id("na", params["na"], session);
          } else if ("vfb" in params) {
            retrieve_neuron_by_id("vfb", params["vfb"], session);
          }
        },
        function(err) {
          console.log("server retrieval error:", err);
        }
      );
    };

    // fired when connection was lost (or could not be established)
    //
    connection.onclose = function(reason, details) {
      console.log("Connection lost: " + reason);
      if (window.login_success == false) {
        var feedback = document.getElementById("auth_feedback");
        feedback.innerHTML = "Incorrect username or password...";
        feedback.style.color = "red";
      }
    };

    // Finally, open the connection
    connection.open();
    console.log('ClientSession connection established to FFBO.');
  }
}
// Former auth.js functions

function createLoginContainer() {
  if (window.direct_access) {
    $.unblockUI();
    $("#welcomepage").hide();
    startGuestConnection();
  } else {
    $.blockUI({
      message: $("#login-container"),
      css: {
        "border-radius": "10px",
        background: "rgba(255,255,255,0.7)",
        "min-width": "300px",
        left: 0,
        right: 0,
        margin: "0 auto"
      }
    });
  }
}

// FIX the snippet here before the module exports:

var user;
var loginBtn = document.getElementById('loginBtn');
loginBtn.addEventListener('click', function(event) {
  // get user
  user = document.getElementById('txt_user').value;
  // get password
  var password = document.getElementById('txt_password').value;
  // get feedback element
  var feedback = document.getElementById('auth_feedback');

  window.ClientSession.start_connection(user, password);
});

function startGuestConnection(ClientSession){
  ClientSession.startConnection("guest", "guestpass");
}

var pwInput = document.getElementById('txt_password');
pwInput.addEventListener("keyup", function(event) {
  event.preventDefault();
  if (event.keyCode == 13)
      loginhBtn.click();
});


module = {};
module.exports = {
  ClientSession: ClientSession,
  retrieveByID: retrieveByID,
  loginBtn: loginBtn,
  pwInput: pwInput,
  user: user,
  startGuestConnection: startGuestConnection,
  createLoginContainer: createLoginContainer,
};