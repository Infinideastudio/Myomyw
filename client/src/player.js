var player = {
    getName: function () {
        var t = storage.getItem("name");
        if (t) {
            return t;
        } else {
            return txt.names.guest;
        }
    },
    setName: function (name) {
        storage.setItem("name", name);
    }
};
