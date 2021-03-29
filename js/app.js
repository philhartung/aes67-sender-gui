const Vue = require('vue/dist/vue.js');
const os = require('os');
const { RtAudio, RtAudioApi } = require('audify');
const sdp = require('./js/sdp');
const aes67 = require('./js/aes67');

let app = new Vue({
	el: '#app',
	data: {
		errors: [],
		settings: {},
		network: [],
		audiodevices: [],
		active: false
	},
	methods: {
		startAudio: function(){
			if(!app.active){
				//determine audio channels
				let audioChannels = 2;
				let deviceName = '';
				for(var i = 0; i < app.audiodevices.length; i++){
					if(app.audiodevices[i].id == app.settings.device){
						audioChannels = Math.min(app.audiodevices[i].channels, 8);
						deviceName = app.audiodevices[i].name;
					}
				}

				aes67.start(app.settings.audioapi, app.settings.device, audioChannels, app.settings.name, app.settings.mcast, app.settings.addr, deviceName);
				app.active = true;
			}else{
				app.active = false;
				aes67.stop();
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
app.settings.mcast = '239.69.'+addresses[0].addr.split('.').splice(2).join('.');
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

for(var i = 0; i < devices.length; i++){
	if(devices[i].inputChannels >= 1 && devices[i].sampleRates.indexOf(48000) !== -1){
		app.audiodevices.push({id: i, name: devices[i].name, samplerates: devices[i].sampleRates, channels: devices[i].inputChannels});
	}
}

if(app.audiodevices.length == 0){
	app.errors.push('No valid audio device found! Please connect an audio device and restart the app.');
}else if(devices[rtAudio.getDefaultInputDevice()].inputChannels >= 1){
	app.settings.device = rtAudio.getDefaultInputDevice();
}else{
	app.settings.device = app.audiodevices[0].id;
}

let deviceName = '';
for(var i = 0; i < app.audiodevices.length; i++){
	if(app.audiodevices[i].id == app.settings.device){
		deviceName = app.audiodevices[i].name+' @ ';
	}
}
app.settings.name = deviceName + os.hostname();