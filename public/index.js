let transactions = [];
let myChart;
let db;

// use indexedDB to create a client side database to be used in offline mode
if (!window.indexedDB) {
  console.log("Your browser doesn't support a stable version of IndexedDB. Offline Mode will not be available. If you would like to use this application offline please use a browser that supports IndexedDB https://caniuse.com/indexeddb");
}

// Open a Database
const request = window.indexedDB.open('offlineBudgetDB', 1)

request.onerror = e => console.log(e.target.errorCode)

request.onupgradeneeded = function(evt) {
  const db = evt.target.result
  db.createObjectStore("offlineBudget", { autoIncrement: true })
}

request.onsuccess = e => {
  console.log(`Successfully opened database ${e.target.name}`)
  db = e.target.result;

  // check if app is online before reading from db
  if (navigator.onLine) {
    checkDatabase();
  }
}

function saveRecord(bankTransaction) {
  console.log(bankTransaction)
  // create a transaction on the offlineBudget db with readwrite access
  const transaction = db.transaction(["offlineBudget"], "readwrite");

  // access your offlineBudget object store
  const store = transaction.objectStore("offlineBudget");

  // add record to your store with add method.
  store.add(bankTransaction);
}

function checkDatabase() {
  // open a transaction on your offlineBudget db
  const transaction = db.transaction(["offlineBudget"], "readwrite");
  // access your OfflineBudget object store
  const store = transaction.objectStore("offlineBudget");
  // get all records from store and set to a variable
  const getAll = store.getAll();

  getAll.onsuccess = function() {
    if (getAll.result.length > 0) {
      fetch("/api/transaction/bulk", {
        method: "POST",
        body: JSON.stringify(getAll.result),
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json"
        }
      })
      .then(response => response.json())
      .then(() => {
        // if successful, open a transaction on your OfflineBudget db
        const transaction = db.transaction(["offlineBudget"], "readwrite");

        // access your OfflineBudget object store
        const store = transaction.objectStore("OfflineBudget");

        // clear all items in your store
        store.clear();
      });
    }
  };
}
// listen for app coming back online
window.addEventListener("online", checkDatabase);

console.log ("nick")

fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  const transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db

    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};
