const Vue = require('vue/dist/vue.js');
const os = require('os');
const { RtAudio, RtAudioApi } = require('audify');
// const sdp = require('./js/sdp');
// const aes67 = require('./js/aes67');
const ptp = require('./js/ptp');

let app = new Vue({
	el: '#app',
	data: {
		errors: [],
		settings: {},
		network: [],
		ptp: {master: '', sync: false},
		audiodevices: []
	},
	methods: {
		startAudio: function(device){
			let index = app.audiodevices.indexOf(device);

			if(app.audiodevices[index].enabled){
				console.log('Stop', device.name);
				app.audiodevices[index].enabled = false;
			}else{
				console.log('Start', device.name);
				app.audiodevices[index].enabled = true;
			}
		},
		setNetworkInterface: function(){
			if(app.settings.addr != app.ptp.addr){
				app.ptp.addr = app.settings.addr;
				ptp.init(app.settings.addr, 0, function(){});
				$('#applyNetworkSettings').prop('disabled', true);
			}
		}
	}
});

//init stuff
//init network options
var interfaces = os.networkInterfaces();
var interfaceNames = Object.keys(interfaces);
var addresses = [];

for(var i = 0; i < interfaceNames.length; i++){
	var interface = interfaces[interfaceNames[i]];

	for(var j = 0; j < interface.length; j++){
		if(interface[j].family == 'IPv4' && interface[j].address != '127.0.0.1'){
			addresses.push({
				name: interfaceNames[i],
				addr: interface[j].address
			});
		}
	}
}

if(addresses.length == 0){
	addresses[0] = '';
	app.errors.push('No network interface found! Please connect to a network and restart the app.');
}

app.settings.addr = addresses[0].addr;
app.network = addresses;

//init audio
switch(process.platform){
	case 'darwin':
		app.settings.audioapi = RtAudioApi.MACOSX_CORE;
	break;
	case 'win32':
		app.settings.audioapi = RtAudioApi.WINDOWS_WASAPI;
	break;
	case 'linux':
		app.settings.audioapi = RtAudioApi.LINUX_ALSA;
	break;
	default:
		app.settings.audioapi = RtAudioApi.UNSPECIFIED;
	break;
}

var rtAudio = new RtAudio(app.settings.audioapi);
var devices = rtAudio.getDevices();
let mcastPrefix = '239.69.';
let networkAddress = addresses[0].addr.split('.');

//init ptp
app.ptp.addr = addresses[0].addr;
ptp.init(addresses[0].addr, 0, function(){});

for(var i = 0; i < devices.length; i++){
	if(devices[i].inputChannels >= 1 && devices[i].sampleRates.indexOf(48000) !== -1){
		var mcast = mcastPrefix + (parseInt(networkAddress[2]) + i) +  '.' + networkAddress[3];
		app.audiodevices.push({id: i, name: devices[i].name, samplerates: devices[i].sampleRates, channels: devices[i].inputChannels, multicast: mcast, enabled: false});
	}
}

if(app.audiodevices.length == 0){
	app.errors.push('No valid audio device found! Please connect an audio device and restart the app.');
}else if(devices[rtAudio.getDefaultInputDevice()].inputChannels >= 1){
	app.settings.device = rtAudio.getDefaultInputDevice();
}else{
	app.settings.device = app.audiodevices[0].id;
}

setInterval(function(){
	app.ptp.master = ptp.ptp_master();
	app.ptp.sync = ptp.is_synced();
}, 20);

$('#networkdevice').on('change', function(){
	let value = $('#networkdevice').val();

	if(app.ptp.addr == value){
		$('#applyNetworkSettings').prop('disabled', true);
	}else{
		$('#applyNetworkSettings').prop('disabled', false);
	}
})