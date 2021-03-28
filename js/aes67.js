const ptpv2 = require('ptpv2');
const dgram = require('dgram');
const { RtAudio, RtAudioFormat, RtAudioApi } = require('audify');

//init udp client
const client = dgram.createSocket('udp4');
client.bind();
let rtAudio;

//AES67 params
const samplerate = 48000;
const ptime = 1;
const fpp = (samplerate / 1000) * ptime;
const encoding = 'L24';
const sessID = Math.round(Date.now() / 1000);
const sessVersion = sessID;
let ptpMaster;
let aes67Multicast;
let addr;

//rtp vars
let seqNum = 0;
let timestampCalc = 0;
let ssrc = sessID % 0x100000000;

//timestamp offset stuff
let offsetSum = 0;
let count = 0;
let correctTimestamp = true;

exports.start = function(audioAPI, audioDevice, audioChannels, streamName, multicastAddress, deciveAddress){
	addr = deciveAddress;
	aes67Multicast = multicastAddress;
	rtAudio = new RtAudio(audioAPI);
	client.setMulticastInterface(deciveAddress);

	//open audio stream
	rtAudio.openStream(null, {deviceId: audioDevice, nChannels: audioChannels, firstChannel: 0}, RtAudioFormat.RTAUDIO_SINT16, samplerate, fpp, streamName, pcm => rtpSend(pcm));

	ptpv2.init(addr, 0, function(){
		ptpMaster = ptpv2.ptp_master();

		//start audio and sdp
		rtAudio.start();
		sdp.start(addr, aes67Multicast, samplerate, audioChannels, encoding, streamName, sessID, sessVersion, ptpMaster);
	});

	//RTP implementation
	let rtpSend = function(pcm){
		//convert L16 to L24
		let samples = pcm.length / 2;
		let l24 = Buffer.alloc(samples * 3);
		
		for(let i = 0; i < samples; i++){
			l24.writeUInt16BE(pcm.readUInt16LE(i * 2), i * 3);
		}
		
		//create RTP header and RTP buffer with header and pcm data
		let rtpHeader = Buffer.alloc(12);
		rtpHeader.writeUInt16BE((1 << 15) + 96, 0);// set version byte and add rtp payload type
		rtpHeader.writeUInt16BE(seqNum, 2);
		rtpHeader.writeUInt32BE(ssrc, 8);
		
		let rtpBuffer = Buffer.concat([rtpHeader, l24]);

		// timestamp correction stuff
		if(correctTimestamp){
			correctTimestamp = false;

			let ptpTime = ptpv2.ptp_time();
			let timestampRTP = ((ptpTime[0] * samplerate) + Math.round((ptpTime[1] * samplerate) / 1000000000)) % 0x100000000;
			timestampCalc = Math.floor(timestampRTP / fpp)*fpp;
		}
		
		//write timestamp
		rtpBuffer.writeUInt32BE(timestampCalc, 4);
		
		//send RTP packet
		client.send(rtpBuffer, 5004, aes67Multicast);

		//timestamp average stuff
		let ptpTime = ptpv2.ptp_time();
		let timestampRTP = ((ptpTime[0] * samplerate) + Math.round((ptpTime[1] * samplerate) / 1000000000)) % 0x100000000;
		offsetSum += Math.abs(timestampRTP - timestampCalc);
		count++;

		//increase timestamp and seqnum
		seqNum = (seqNum + 1) % 0x10000;
		timestampCalc = (timestampCalc + fpp) % 0x100000000;
	}

	//Interval for timestamp correction calculation
	setInterval(function(){
		let avg = Math.round(offsetSum / count);

		if(avg > fpp){
			correctTimestamp = true;
		}

		offsetSum = 0;
		count = 0;
	}, 100);
}

exports.stop = function(){
	rtAudio.stop();
	sdp.stop();
}