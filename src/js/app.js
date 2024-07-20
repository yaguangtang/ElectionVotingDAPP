App = {
  web3Provider: null,
  contracts: {},
  account: '0x0',
  hasVoted: false,

  init: function () {
    return App.initWeb3();
  },

  initWeb3: async function () {
    // Modern dapp browsers...
    if (window.ethereum) {
      App.web3Provider = window.ethereum;
      try {
        // Request account access
        await window.ethereum.request({ method: 'eth_requestAccounts' });
      } catch (error) {
        // User denied account access...
        alert('User denied account access');
      }
      web3 = new Web3(window.ethereum);
    }
    // Legacy dapp browsers...
    else if (window.web3) {
      App.web3Provider = web3.currentProvider;
      web3 = new Web3(web3.currentProvider);
    }
    // If no injected web3 instance is detected, fall back to Ganache
    else {
      App.web3Provider = new Web3.providers.HttpProvider('http://localhost:7545');
      web3 = new Web3(App.web3Provider);
    }
    return App.initContract();
  },

  initContract: function () {
    $.getJSON('Election.json', function (election) {
      // Instantiate a new web3 contract from the artifact
      App.contracts.Election = new web3.eth.Contract(election.abi, '0xE664377f4943BF6a567F29B59ff301532246aCdE');
      App.listenForEvents();
      return App.render();
    });
  },

  // Listen for events emitted from the contract
  listenForEvents: function () {
    App.contracts.Election.events.votedEvent({}, { fromBlock: 0, toBlock: 'latest' })
      .on('data', function (event) {
        console.log('event triggered', event);
        // Reload when a new vote is recorded
        App.render();
      })
      .on('error', console.error);
  },

  render: async () => {
    var electionInstance;
    var loader = $('#loader');
    var content = $('#content');

    loader.show();
    content.hide();

    // Load account data
    try {
      const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
      App.account = accounts[0];
      $('#accountAddress').html('Your Account: ' + App.account);
    } catch (error) {
      if (error.code === 4001) {
        // User rejected request
        alert('You need to allow account access to use this dApp.');
      }
      console.log(error);
    }

    // Load contract data
    App.contracts.Election.methods.candidatesCount().call().then(async (candidatesCount) => {
      const promise = [];
      for (var i = 1; i <= candidatesCount; i++) {
        promise.push(App.contracts.Election.methods.candidates(i).call());
      }

      const candidates = await Promise.all(promise);
      var candidatesResults = $('#candidatesResults');
      candidatesResults.empty();

      var candidatesSelect = $('#candidatesSelect');
      candidatesSelect.empty();

      for (var i = 0; i < candidatesCount; i++) {
        var id = candidates[i].id;
        var name = candidates[i].name;
        var voteCount = candidates[i].voteCount;

        // Render candidate Result
        var candidateTemplate = `<tr><th>${id}</th><td>${name}</td><td>${voteCount}</td></tr>`;
        candidatesResults.append(candidateTemplate);

        // Render candidate ballot option
        var candidateOption = `<option value='${id}'>${name}</option>`;
        candidatesSelect.append(candidateOption);
      }

      return App.contracts.Election.methods.voters(App.account).call();
    }).then(function (hasVoted) {
      // Do not allow a user to vote
      if (hasVoted) {
        $('form').hide();
      }
      loader.hide();
      content.show();
    }).catch(function (error) {
      console.warn(error);
    });
  },

  castVote: function () {
    var candidateId = $('#candidatesSelect').val();
    App.contracts.Election.methods.vote(candidateId).send({ from: App.account })
      .on('receipt', function (receipt) {
        // Wait for votes to update
        $('#content').hide();
        $('#loader').show();
      })
      .on('error', function (error) {
        console.error(error);
      });
  },
};

$(function () {
  $(window).load(function () {
    App.init();
  });
});
