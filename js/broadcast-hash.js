function rawtotxid(raw) {

    var firstSHA = Crypto.SHA256(Crypto.util.hexToBytes(raw))
    var secondSHA = Crypto.SHA256(Crypto.util.hexToBytes(firstSHA))    
   
    return reverseBytes(secondSHA);  

}

function create_hash_broadcast_data(hash, value) {
       
        //data length (61 bytes) + CNTRPRTY indentifier (CNTRPRTY) + Transaction Type ID (30)
        var cntrprty_prefix = "3d434e5452505254590000001e"; 
    
        //broadcast timestamped with current UTC time
        var currenttime = Math.floor(Date.now() / 1000);
        var currenttime_hex = currenttime.toString(16);   
            
        //broadcast value
        var value_binary = toIEEE754Double(parseFloat(value));
        var value_hex_array = new Array();
        for (i = 0; i < value_binary.length; ++i) {
            value_hex_array[i] = pad(value_binary[i].toString(16),2);
        }
        var value_hex = value_hex_array.join("");        
        
        //broadcast fee set to zero
        var feefraction_hex = "00000000";
        
        //message length (32 bytes)
        var messagelength_hex = "20";
        var message_hex = hash;
        
        //assemble into Counterparty transaction data
        var broadcast_tx_data = cntrprty_prefix + currenttime_hex + value_hex + feefraction_hex + messagelength_hex + message_hex;
        
        return broadcast_tx_data;
    
}


function hashBroadcast(add_from, message, value, msig_total, transfee, mnemonic, callback) {
       
    var privkey = getprivkey(add_from, mnemonic);
     
    var source_html = "https://insight.bitpay.com/api/addr/"+add_from+"/utxo";
    var total_utxo = new Array();   
       
    $.getJSON( source_html, function( data ) {
        
        var amountremaining = parseFloat(msig_total) + parseFloat(transfee);
        
        data.sort(function(a, b) {
            return b.amount - a.amount;
        });
        
        $.each(data, function(i, item) {
            
             var txid = data[i].txid;
             var vout = data[i].vout;
             var script = data[i].scriptPubKey;
             var amount = parseFloat(data[i].amount);
             
             amountremaining = amountremaining - amount;            
             amountremaining.toFixed(8);
    
             var obj = {
                "txid": txid,
                "address": add_from,
                "vout": vout,
                "scriptPubKey": script,
                "amount": amount
             };
            
             total_utxo.push(obj);
              
             //dust limit = 5460 
            
             if (amountremaining == 0 || amountremaining < -0.00005460) {                                 
                 return false;
             }
             
        });
    
        var utxo_key = total_utxo[0].txid;
        
        if (amountremaining < 0) {
            var satoshi_change = -(amountremaining.toFixed(8) * 100000000).toFixed(0);
        } else {
            var satoshi_change = 0;
        }
    
        var datachunk_unencoded = create_hash_broadcast_data(message, value);
        
        if (datachunk_unencoded != "error") {
        
            var datachunk_encoded = xcp_rc4(utxo_key, datachunk_unencoded);
            var address_array = addresses_from_datachunk(datachunk_encoded);
        
            var sender_pubkeyhash = new bitcore.PublicKey(bitcore.PrivateKey.fromWIF(privkey));
        
            var scriptstring = "OP_1 33 0x"+address_array[0]+" 33 0x"+address_array[1]+" 33 0x"+sender_pubkeyhash+" OP_3 OP_CHECKMULTISIG";
            console.log(scriptstring);
            var data_script = new bitcore.Script(scriptstring);
        
            var transaction = new bitcore.Transaction();
            
            for (i = 0; i < total_utxo.length; i++) {
                transaction.from(total_utxo[i]);
            }
        
            var msig_total_satoshis = parseFloat((msig_total * 100000000).toFixed(0));
        
            var xcpdata_msig = new bitcore.Transaction.Output({script: data_script, satoshis: msig_total_satoshis}); 
        
            transaction.addOutput(xcpdata_msig);
                  
            if (satoshi_change > 5459) {
                transaction.to(add_from, satoshi_change);
            }
        
            transaction.sign(privkey);

            var final_trans = transaction.serialize();
            
        } else {
            
            var final_trans = "error";
            
        }
        
        console.log(final_trans);
        
        $("#raw").append(final_trans); 
        
        callback(final_trans);
        //sendBTCpush(final_trans);  //uncomment to push raw tx to the bitcoin network

    });
    
}

