var http = {
    request: function (type, url, data, handler) {
        var xhr = cc.loader.getXMLHttpRequest();
        xhr.open(type, url);
        xhr.timeout = 5000;
        xhr.onerror = handler.bind(null, null, "error", xhr);
        xhr.ontimeout = handler.bind(null, null, "timeout", xhr);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                handler(xhr.responseText, "success", xhr);
            }
        };
        xhr.send(JSON.stringify(data));
    }
}