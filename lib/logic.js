/*
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

/* global getParticipantRegistry getAssetRegistry getFactory */

async function payOut(productReceived) {  // eslint-disable-line no-unused-vars

    const contract = productReceived.product.contract;
    const product = productReceived.product;
    let payOut = contract.unitPrice * product.unitCount;

    console.log('Received at: ' + productReceived.timestamp);
    console.log('Contract arrivalDateTime: ' + contract.arrivalDateTime);

    // set the status of the shipment
    shipment.status = 'ARRIVED';

    // if the shipment did not arrive on time the payout is zero
    if (productReceived.timestamp > contract.arrivalDateTime) {
        payOut = 0;
        console.log('Late product received');
    } else {
        // find the lowest temperature reading
        if (product.temperatureReadings) {
            // sort the temperatureReadings by centigrade
            product.temperatureReadings.sort(function (a, b) {
                return (a.centigrade - b.centigrade);
            });
            const lowestReading = product.temperatureReadings[0];
            const highestReading = product.temperatureReadings[product.temperatureReadings.length - 1];
            let penalty = 0;
            console.log('Lowest temp reading: ' + lowestReading.centigrade);
            console.log('Highest temp reading: ' + highestReading.centigrade);

            // does the lowest temperature violate the contract?
            if (lowestReading.centigrade < contract.minTemperature) {
                penalty += (contract.minTemperature - lowestReading.centigrade) * contract.minPenaltyFactor;
                console.log('Min temp penalty: ' + penalty);
            }

            // does the highest temperature violate the contract?
            if (highestReading.centigrade > contract.maxTemperature) {
                penalty += (highestReading.centigrade - contract.maxTemperature) * contract.maxPenaltyFactor;
                console.log('Max temp penalty: ' + penalty);
            }

            // apply any penalities
            payOut -= (penalty * product.unitCount);

            if (payOut < 0) {
                payOut = 0;
            }
        }
    }

    console.log('Payout: ' + payOut);
    // need to add logic about more participants here as well
   
   // under construction
    contract.grower.accountBalance += payOut;
    contract.customer.accountBalance -= payOut;

    console.log('Grower: ' + contract.grower.$identifier + ' new balance: ' + contract.grower.accountBalance);
    console.log('Importer: ' + contract.importer.$identifier + ' new balance: ' + contract.importer.accountBalance);
    // under construction----
  
    // update the grower's balance
    const growerRegistry = await getParticipantRegistry('org.acme.foodchain.goods.Grower');
    await growerRegistry.update(contract.grower);
    
    // update the wholesaler's balance
    const wholesalerRegistry = await getParticipantRegistry('org.acme.foodchain.goods.Wholesaler');
    await wholesalerRegistry.update(contract.wholesaler);
   
   // update the retailer's balance
    const retailerRegistry = await getParticipantRegistry('org.acme.foodchain.goods.Retailer');
    await retailerRegistry.update(contract.retailer);
   
   // update the customer's balance
    const customerRegistry = await getParticipantRegistry('org.acme.foodchain.goods.Customer');
    await customerRegistry.update(contract.customer);

}

/**
 * A temperature reading has been received for product
 * @param {org.acme.foodchain.goods.TemperatureReading} temperatureReading - the TemperatureReading transaction
 * @transaction
 */
async function temperatureReading(temperatureReading) {  // eslint-disable-line no-unused-vars

    const product = temperatureReading.product;

    console.log('Adding temperature ' + temperatureReading.centigrade + ' to shipment ' + product.$identifier);

    if (product.temperatureReadings) {
        product.temperatureReadings.push(temperatureReading);
    } else {
        product.temperatureReadings = [temperatureReading];
    }

    // add the temp reading to the shipment
    const productRegistry = await getAssetRegistry('org.acme.foodchain.goods.Product');
    await productRegistry.update(product);
}


async function setupDemo(setupDemo) {  // eslint-disable-line no-unused-vars

    const factory = getFactory();
    const NS = 'org.acme.foodchain.goods';

    // create the grower
    const grower = factory.newResource(NS, 'Grower', 'grower@email.com');
    const growerAddress = factory.newConcept(NS, 'Address');
    growerAddress.country = 'India';
    grower.address = growerAddress;
    grower.accountBalance = 0;


    // create the wholesaler
    const wholesaler = factory.newResource(NS, 'Wholesaler', 'wholesaler@email.com');
    const wholesalerAddress = factory.newConcept(NS, 'Address');
    wholesalerAddress.country = 'India';
    wholesaler.address = wholesalerAddress;
    wholesaler.accountBalance = 0;
    
    
    // create the retailer
    const retailer = factory.newResource(NS, 'Retailer', 'retailer@email.com');
    const retailerAddress = factory.newConcept(NS, 'Address');
    retailerAddress.country = 'India';
    retailer.address = retailerAddress;
    retailer.accountBalance = 0;


    // create the customer
    const customer = factory.newResource(NS, 'Customer', 'customer@email.com');
    const customerAddress = factory.newConcept(NS, 'Address');
    customerAddress.country = 'India';
    customer.address = customerAddress;
    customer.accountBalance = 0;

    // create the contract
    const contract = factory.newResource(NS, 'Contract', 'CON_001');
    contract.grower = factory.newRelationship(NS, 'Grower', 'grower@email.com');
    contract.wholesaler = factory.newRelationship(NS, 'Wholesaler', 'wholesaler@email.com');
    contract.retailer = factory.newRelationship(NS, 'Retailer', 'retailer@email.com');
    contract.customer = factory.newRelationship(NS, 'Customer', 'customer@email.com');
    
    const tomorrow = setupDemo.timestamp;
    tomorrow.setDate(tomorrow.getDate() + 1);
    contract.arrivalDateTime = tomorrow; // the shipment has to arrive tomorrow
    contract.unitPrice = 0.5; // pay 50 cents per unit
    contract.minTemperature = 2; // min temperature for the cargo
    contract.maxTemperature = 10; // max temperature for the cargo
    contract.minPenaltyFactor = 0.2; // we reduce the price by 20 cents for every degree below the min temp
    contract.maxPenaltyFactor = 0.1; // we reduce the price by 10 cents for every degree above the max temp

    // create the shipment
    const shipment = factory.newResource(NS, 'Product', 'SHIP_001');
    shipment.type = 'BANANAS';
    shipment.status = 'IN_TRANSIT';
    shipment.unitCount = 5000;
    shipment.contract = factory.newRelationship(NS, 'Contract', 'CON_001');

    // add the growers
    const growerRegistry = await getParticipantRegistry(NS + '.Grower');
    await growerRegistry.addAll([grower]);
    
    // add the wholesalers
    const wholesalerRegistry = await getParticipantRegistry(NS + '.Wholesaler');
    await wholesalerRegistry.addAll([wholesaler]);

    
    // add the retailers
    const retailerRegistry = await getParticipantRegistry(NS + '.Retailer');
    await retailerRegistry.addAll([retailer]);

    // add the customer
    const customerRegistry = await getParticipantRegistry(NS + '.Customer');
    await customerRegistry.addAll([customer]);

    // add the contracts
    const contractRegistry = await getAssetRegistry(NS + '.Contract');
    await contractRegistry.addAll([contract]);

    // add the product's record
    const productRegistry = await getAssetRegistry(NS + '.Product');
    await productRegistry.addAll([product]);
}
