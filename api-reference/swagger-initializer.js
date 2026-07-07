// Track active YAML requests and rendering state
let activeRequests = 0;
let errorCount = 0;
let renderPending = true;
let renderTimeout;
const MAX_ERRORS = 3;

// Show loader initially
document.addEventListener('DOMContentLoaded', function() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.style.display = 'flex';
    loader.dataset.phase = 'loading';
  }
  
  // Wrap fetch to track YAML requests
  const originalFetch = window.fetch;
  window.fetch = function(...args) {
    const url = args[0];
    
    if (isDomainYAML(url)) {
      activeRequests++;
      console.log(`Loading YAML: ${url} (Active: ${activeRequests})`);
      
      return originalFetch.apply(this, args)
        .then(response => {
          activeRequests--;
          console.log(`Loaded YAML: ${url} (Remaining: ${activeRequests})`);
          checkRequestsComplete();
          return response;
        })
        .catch(err => {
          activeRequests--;
          errorCount++;
          console.error(`Failed to load YAML: ${url}`, err);
          
          if (errorCount >= MAX_ERRORS) {
            console.warn('Too many YAML load errors, hiding loader');
            hideLoader();
          } else {
            checkRequestsComplete();
          }
          throw err;
        });
    }
    
    return originalFetch.apply(this, args);
  };
});

// Check if domain YAML file
function isDomainYAML(url) {
  try {
    const pathname = new URL(url, window.location.href).pathname;
    return pathname.includes('/Domains/') && pathname.endsWith('.yaml');
  } catch {
    return url.includes('/Domains/') && url.endsWith('.yaml');
  }
}

// Monitor rendering progress
function monitorRendering() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.dataset.phase = 'rendering';
    console.log('Switching to rendering phase');
  }
  
  const observer = new MutationObserver(() => {
    const swaggerContainer = document.getElementById('swagger-ui');
    const operationTagContent = swaggerContainer && swaggerContainer.querySelector('.operation-tag-content');
    
    if (operationTagContent) {
      console.log('Operation tag content detected, checking completion...');
      
      // Wait a bit more to ensure all operation-tag-content elements are rendered
      setTimeout(() => {
        const operationContents = swaggerContainer.querySelectorAll('.operation-tag-content');
        if (operationContents.length > 0) {
          console.log(`Found ${operationContents.length} operation tag content blocks, rendering complete`);
          renderPending = false;
          checkRenderComplete();
          observer.disconnect();
        }
      }, 2000); // Increased wait time for full rendering
    }
  });
  
  const swaggerContainer = document.getElementById('swagger-ui');
  if (swaggerContainer) {
    observer.observe(swaggerContainer, {
      childList: true,
      subtree: true
    });
  }
  
  // Safety timeout for rendering
  renderTimeout = setTimeout(() => {
    console.warn('Rendering timeout reached, assuming complete');
    renderPending = false;
    checkRenderComplete();
    observer.disconnect();
  }, 12000); // Increased timeout for more complex rendering
}

// Check if all requests are complete
function checkRequestsComplete() {
  if (activeRequests === 0) {
    console.log('All YAML files loaded, starting render monitoring');
    monitorRendering();
  }
}

// Check if rendering is complete
function checkRenderComplete() {
  if (!renderPending) {
    clearTimeout(renderTimeout);
    console.log('Rendering complete, hiding loader');
    hideLoader();
  }
}

// Hide loader function
function hideLoader() {
  const loader = document.getElementById('loader');
  if (loader) {
    loader.classList.add('hidden');
    setTimeout(() => {
      loader.style.display = 'none';
    }, 300); // Wait for fade transition
  }
}

window.onload = function() {
  //<editor-fold desc="Changeable Configuration Block">

  // the following lines will be replaced by docker/configurator, when it runs in a docker-container
  window.ui = SwaggerUIBundle({
    url: "./turbo-smtp.yaml", //https://petstore.swagger.io/v2/swagger.json",
    dom_id: '#swagger-ui',
    deepLinking: true,
    presets: [
      SwaggerUIBundle.presets.apis,
      SwaggerUIStandalonePreset
    ],
    plugins: [
      SwaggerUIBundle.plugins.DownloadUrl
    ],
	  //layout: "StandaloneLayout",
    persistAuthorization: true,
    requestSnippetsEnabled: true,
    showExtensions: true,
    showCommonExtensions: true,
    syntaxHighlight: {
      activated: true,
    },
    requestSnippets: {
      generators: {
        curl_bash: {
          title: "cURL (bash)",
          syntax: "bash"
        },
        curl_powershell: {
          title: "cURL (PowerShell)",
          syntax: "powershell"
        },
        curl_cmd: {
          title: "cURL (CMD)",
          syntax: "bash"
        },
        javascript_fetch: {
          title: "JavaScript (Fetch)",
          syntax: "javascript"
        },
        python_requests: {
          title: "Python (Requests)",
          syntax: "python"
        },
        java_httpclient: {
          title: "Java (HttpClient)",
          syntax: "java"
        },
        csharp_httpclient: {
          title: "C# (HttpClient)",
          syntax: "csharp"
        }
      },
      defaultExpanded: true
    }
  });

  // Fallback: hide loader after 20 seconds regardless
  setTimeout(() => {
    console.warn('Fallback timeout reached, hiding loader');
    hideLoader();
  }, 20000);

  //</editor-fold>
};
