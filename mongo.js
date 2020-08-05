var ObjectID = require('bson-objectid');

module.exports = {
  "localhost:27017": {
    "databases": {
      "myproject": {
        "collections": [
          {
            "name": "system.namespaces",
            "documents": [
              {
                "name": "system.indexes"
              }
            ]
          },
          {
            "name": "system.indexes",
            "documents": []
          }
        ]
      },
      "undefined": {
        "collections": [
          {
            "name": "system.namespaces",
            "documents": [
              {
                "name": "system.indexes"
              },
              {
                "name": "documents"
              },
              {
                "name": "documents1"
              }
            ]
          },
          {
            "name": "system.indexes",
            "documents": [
              {
                "v": 1,
                "key": {
                  "_id": 1
                },
                "ns": "undefined.documents",
                "name": "_id_",
                "unique": true
              },
              {
                "v": 1,
                "key": {
                  "_id": 1
                },
                "ns": "undefined.documents1",
                "name": "_id_",
                "unique": true
              }
            ]
          },
          {
            "name": "documents",
            "documents": [
              {
                "a": 1,
                "_id": ObjectID("5f2a9830f8be8a665e556060")
              },
              {
                "a": 2,
                "_id": ObjectID("5f2a9830f8be8a665e556061")
              },
              {
                "a": 3,
                "_id": ObjectID("5f2a9830f8be8a665e556062")
              }
            ]
          },
          {
            "name": "documents1",
            "documents": [
              {
                "a": 1,
                "_id": ObjectID("5f2a9830f8be8a665e556063")
              },
              {
                "a": 2,
                "_id": ObjectID("5f2a9830f8be8a665e556064")
              },
              {
                "a": 3,
                "_id": ObjectID("5f2a9830f8be8a665e556065")
              }
            ]
          }
        ]
      }
    }
  }
}