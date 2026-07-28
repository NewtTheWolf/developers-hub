# MailApi

All URIs are relative to *https://pro.api.serversmtp.com/api/v2*

| Method | HTTP request | Description |
|------------- | ------------- | -------------|
| [**sendEmail**](MailApi.md#sendemail) | **POST** /mail/send | Send email message |



## sendEmail

> SendSucessResponsetBody sendEmail(mailMessage)

Send email message

Send email message  ###### Servers  | Host | Region | |---|---| | &#x60;https://api.turbo-smtp.com/api/v2&#x60; | Global (default) | | &#x60;https://api.eu.turbo-smtp.com/api/v2&#x60; | European infrastructure — use for EU data residency |  ###### **Notes:** **- ConsumerKey / ConsumerSecret headers should be used. This endpoint does not support Authorization header**  **- Switch between samples to learn about advanced features such as using attachments, custom headers like reply-to address, tracking, embeded images and others.**  ###### Limitations:      * The total size of your email, including attachments, must be less than 24MB. 

### Example

```ts
import {
  Configuration,
  MailApi,
} from '@turbosmtp/sdk';
import type { SendEmailRequest } from '@turbosmtp/sdk';

async function example() {
  console.log("🚀 Testing @turbosmtp/sdk SDK...");
  const config = new Configuration({ 
    // To configure API key authorization: consumerSecret
    apiKey: "YOUR API KEY",
    // To configure API key authorization: ApiKeyAuth
    apiKey: "YOUR API KEY",
    // To configure API key authorization: consumerKey
    apiKey: "YOUR API KEY",
  });
  const api = new MailApi(config);

  const body = {
    // MailMessage
    mailMessage: {"from":"FROM NAME <user@example.com>","to":"user@example.com,user2@example.com","subject":"This is a test message","cc":"cc_user@example.com","bcc":"bcc_user@example.com","content":"This is plain text version of the message.","html_content":"This is <b>HTML</b> version of the message."},
  } satisfies SendEmailRequest;

  try {
    const data = await api.sendEmail(body);
    console.log(data);
  } catch (error) {
    console.error(error);
  }
}

// Run the test
example().catch(console.error);
```

### Parameters


| Name | Type | Description  | Notes |
|------------- | ------------- | ------------- | -------------|
| **mailMessage** | [MailMessage](MailMessage.md) |  | |

### Return type

[**SendSucessResponsetBody**](SendSucessResponsetBody.md)

### Authorization

[consumerSecret](../README.md#consumerSecret), [ApiKeyAuth](../README.md#ApiKeyAuth), [consumerKey](../README.md#consumerKey)

### HTTP request headers

- **Content-Type**: `application/json`
- **Accept**: `application/json`


### HTTP response details
| Status code | Description | Response headers |
|-------------|-------------|------------------|
| **200** | Sucess  Turbo-SMTP successfully received your message.  |  -  |
| **400** | Bad Request  There was a problem processing the request due to an invalid/missing parameter for the request.  |  -  |
| **401** | Unauthorized  Missing or Invalid Turbo-SMTP credentials provided.  |  -  |

[[Back to top]](#) [[Back to API list]](../README.md#api-endpoints) [[Back to Model list]](../README.md#models) [[Back to README]](../README.md)

