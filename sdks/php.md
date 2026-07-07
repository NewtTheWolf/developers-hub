# PHP SDK

The official TurboSMTP SDK for PHP applications.

**Status:** Stable

---

## Installation

```bash
composer require turbosmtp/turbosmtp-client
```

**Requirements:** PHP 7.4+, Composer

---

## Configuration

```php
require 'vendor/autoload.php';

use TurboSMTP\TurboSMTPClientConfigurationBuilder;
use TurboSMTP\TurboSMTPClient;

$config = (new TurboSMTPClientConfigurationBuilder())
    ->setConsumerKey('YOUR_CONSUMER_KEY')
    ->setConsumerSecret('YOUR_CONSUMER_SECRET')
    ->setTimezone('UTC')
    ->setRegion('eu')
    ->build();

$client = new TurboSMTPClient($config);
```

---

## Send an Email

```php
$response = $client->getMail()->send([
    'from'    => 'you@yourdomain.com',
    'to'      => ['recipient@example.com'],
    'subject' => 'Hello from TurboSMTP',
    'html'    => '<h1>It works!</h1>',
]);
```

---

## Validate an Email

```php
$result = $client->getValidation()->verify('user@example.com');
echo $result->getStatus(); // "valid", "invalid", etc.
```

---

## Source

The PHP SDK source is available in the TurboSMTP GitHub organization.

---

## Reporting Issues

If you encounter behavior that does not match the [API Reference](../api-reference/README.md), please open a [Bug Report](../.github/ISSUE_TEMPLATE/bug_report.md).
