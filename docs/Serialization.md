# Serialization

Routes can define a `responseSchema` to optimize serialization JSON responses.
The `responseSchema` is compiled by [`compile-json-stringify`](https://www.npmjs.com/package/compile-json-stringify)
which will stringify the response body 2-8x faster than `JSON.stringify()`.

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      hello: { type: 'string' }
    }
  }
};

app.get('/', { responseSchema }, (req, res) => {
  res.send({ hello: 'world' });
});
```

The structure of the schema is a mapping of a *status code* to a
*`compile-json-stringify` schema*. Different schemas can be set
for different status codes.

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      value: { type: 'string' },
      fast: { type: 'boolean' }
    }
  },
  201: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      error: { type: ['string', 'null'] }
    }
  }
};

app.post('/info', { responseSchema }, (req, res) => {
  if (req.body.createInfo) {
    // Create info ...
    res.status(201).send({ success: true, error: null });
  } else {
    res.send({ value: 'medley', fast: true });
  }
});
```

The compiled `stringify` function will also exclude any properties that are not
included in the schema (which can prevent accidental disclosure of sensitive
information, although it is not recommended to use this as the primary method
of preventing data leaks).

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      hello: { type: 'string' }
    }
  }
};

app.get('/', { responseSchema }, (req, res) => {
  res.send({
    hello: 'world',
    greetings: 'universe', // This property will be excluded from the response
  });
});
```

For more information on how to define a response schema, see the
[`compile-json-stringify` documentation](https://github.com/nwoltman/compile-json-stringify).

## Object Shorthand

Medley allows schemas to use a "shorthand" format for object schema definitions.
If the schema for a status code is missing the `type` and `properties` keyword
properties, Medley will wrap it in a `{type: 'object', properties: statusSchema}`
object so that it will be compiled properly.

```js
const responseSchema = {
  200: {
    hello: { type: 'string' }
  }
};

app.get('/', { responseSchema }, (req, res) => {
  res.send({ hello: 'world' });
});
```

## Incorrect Types in the Payload

`compile-json-stringify` works just like `JSON.stringify()`
([mostly](https://github.com/nwoltman/compile-json-stringify#differences-from-jsonstringify)).
If a part of the payload being sent doesn't match the schema, it will still be serialized.

```js
const responseSchema = {
  200: {
    type: 'object',
    properties: {
      value: { type: 'string' }
    }
  }
};

app.get('/mismatch', { responseSchema }, (req, res) => {
  res.send({ value: [1, 2, 3] }); // Gets serialized to: '{"value":[1,2,3]}'
});
```
