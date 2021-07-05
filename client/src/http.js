var http = {
    get: function (url, handler) {
        var xhr = cc.loader.getXMLHttpRequest();
        xhr.open("GET", url);
        xhr.timeout = 5000;
        xhr.onerror = handler.bind(null, null, "connection error", xhr);
        xhr.ontimeout = handler.bind(null, null, "timeout", xhr);
        xhr.onreadystatechange = function () {
            if (xhr.readyState == 4 && xhr.status == 200) {
                handler(xhr.responseText, null, xhr);
            }
        };
        xhr.send();
    },

    getJson: function (url, handler) {
        this.get(url, function (data, error, xhr) {
            if (error) {
                handler(null, error, xhr);
            }
            else {
                try {
                    handler(JSON.parse(data), null, xhr);
                }
                catch (e) {
                    handler(null, "parse json error", xhr);
                }
            }
        });
    }
}