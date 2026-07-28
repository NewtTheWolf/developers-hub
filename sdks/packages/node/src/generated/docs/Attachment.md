
# Attachment


## Properties

Name | Type
------------ | -------------
`content` | string
`contentId` | string
`name` | string
`type` | string

## Example

```typescript
import type { Attachment } from '@turbosmtp/sdk'

// TODO: Update the object below with actual values
const example = {
  "content": dXBsb2FkZXIxQGdtYWlsLmNvbQ0KdXBsb2FkZXIyQGdtYWlsLmNvbQ0KYWJjMQ==,
  "contentId": null,
  "name": email.ico,
  "type": image/gif,
} satisfies Attachment

console.log(example)

// Convert the instance to a JSON string
const exampleJSON: string = JSON.stringify(example)
console.log(exampleJSON)

// Parse the JSON string back to an object
const exampleParsed = JSON.parse(exampleJSON) as Attachment
console.log(exampleParsed)
```

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)


