/**
 * VOFC Test Runner
 * Simple interface to run VOFC system tests
 */

class VOFCTestRunner {
    constructor() {
        this.testingFramework = null;
        this.isRunning = false;
    }
    
    /**
     * Run all tests
     */
    async runTests() {
        if (this.isRunning) {
            console.log('⚠️ Tests already running...');
            return;
        }
        
        this.isRunning = true;
        console.log('🚀 Starting VOFC System Tests...');
        
        try {
            // Try comprehensive testing first
            if (typeof VOFCTestingFramework !== 'undefined') {
                this.testingFramework = new VOFCTestingFramework();
                const results = await this.testingFramework.runAllTests();
                window.vofcTestResults = results;
                console.log('✅ Comprehensive tests completed! Results stored in window.vofcTestResults');
                return results;
            } else {
                // Fall back to effectiveness testing
                console.log('⚠️ Comprehensive testing not available, running effectiveness tests...');
                return await this.runEffectivenessTests();
            }
            
        } catch (error) {
            console.error('❌ Test execution failed:', error);
            console.log('🔄 Falling back to effectiveness testing...');
            try {
                return await this.runEffectivenessTests();
            } catch (fallbackError) {
                console.error('❌ Fallback testing also failed:', fallbackError);
                throw fallbackError;
            }
        } finally {
            this.isRunning = false;
        }
    }
    
    /**
     * Run effectiveness tests (standalone)
     */
    async runEffectivenessTests() {
        console.log('🧪 Running VOFC Effectiveness Tests...');
        
        try {
            // Initialize effectiveness testing framework
            this.effectivenessTest = new VOFCEffectivenessTest();
            
            // Run all tests
            const results = await this.effectivenessTest.runAllTests();
            
            // Store results globally for inspection
            window.vofcTestResults = results;
            
            console.log('✅ Effectiveness tests completed! Results stored in window.vofcTestResults');
            
            return results;
            
        } catch (error) {
            console.error('❌ Effectiveness test execution failed:', error);
            throw error;
        }
    }
    
    /**
     * Run quick performance test
     */
    async runQuickTest() {
        console.log('⚡ Running quick performance test...');
        
        const testData = {
            has_perimeter_barriers: 'No',
            vss_present: 'No',
            secforce_247: 'No'
        };
        
        const iterations = 100;
        const times = [];
        
        // Test new system
        for (let i = 0; i < iterations; i++) {
            const start = performance.now();
            try {
                window.vofcMatcher.analyzeAssessment(testData);
            } catch (error) {
                console.warn('Test error:', error);
            }
            const end = performance.now();
            times.push(end - start);
        }
        
        const average = times.reduce((sum, time) => sum + time, 0) / times.length;
        const min = Math.min(...times);
        const max = Math.max(...times);
        
        console.log(`📊 Quick Test Results (${iterations} iterations):`);
        console.log(`  Average: ${average.toFixed(2)}ms`);
        console.log(`  Min: ${min.toFixed(2)}ms`);
        console.log(`  Max: ${max.toFixed(2)}ms`);
        
        return { average, min, max, times };
    }
    
    /**
     * Test specific vulnerability detection
     */
    testVulnerabilityDetection() {
        console.log('🎯 Testing vulnerability detection...');
        
        const testCases = [
            {
                name: 'No Perimeter Barriers',
                data: { has_perimeter_barriers: 'No' },
                expectedVulns: ['V001']
            },
            {
                name: 'No Video Surveillance',
                data: { vss_present: 'No' },
                expectedVulns: ['V011']
            },
            {
                name: 'No Security Personnel',
                data: { secforce_247: 'No' },
                expectedVulns: ['V013']
            },
            {
                name: 'Insufficient Standoff Distance',
                data: { standoff_minimum_distance: 25 },
                expectedVulns: ['V008']
            }
        ];
        
        const results = [];
        
        for (const testCase of testCases) {
            try {
                const analysis = window.vofcMatcher.analyzeAssessment(testCase.data);
                const detectedVulns = analysis.vulnerabilities.map(v => v.id);
                
                const matches = testCase.expectedVulns.filter(expected => 
                    detectedVulns.includes(expected)
                );
                
                const accuracy = (matches.length / testCase.expectedVulns.length) * 100;
                
                results.push({
                    testCase: testCase.name,
                    expected: testCase.expectedVulns,
                    detected: detectedVulns,
                    matches: matches,
                    accuracy: accuracy
                });
                
                console.log(`  ${testCase.name}: ${accuracy.toFixed(1)}% accuracy`);
                
            } catch (error) {
                console.error(`  ${testCase.name}: Error -`, error);
                results.push({
                    testCase: testCase.name,
                    error: error.message
                });
            }
        }
        
        return results;
    }
    
    /**
     * Test field mapping effectiveness
     */
    testFieldMapping() {
        console.log('🔗 Testing field mapping effectiveness...');
        
        const testData = {
            // Direct field access
            has_perimeter_barriers: 'No',
            vss_present: 'No',
            
            // Nested field access
            sections: {
                physical_security: {
                    has_perimeter_barriers: 'No'
                },
                security_systems: {
                    vss_present: 'No'
                }
            },
            
            // Different naming conventions
            'standoff-perimeter-fencing': 'None',
            'vss_system_type': 'None'
        };
        
        try {
            const analysis = window.vofcMatcher.analyzeAssessment(testData);
            
            console.log(`  Detected ${analysis.vulnerabilities.length} vulnerabilities`);
            console.log(`  Generated ${analysis.options.length} options`);
            console.log(`  Overall Score: ${analysis.overallScore}`);
            
            return {
                vulnerabilityCount: analysis.vulnerabilities.length,
                optionCount: analysis.options.length,
                overallScore: analysis.overallScore
            };
            
        } catch (error) {
            console.error('  Field mapping test failed:', error);
            return { error: error.message };
        }
    }
    
    /**
     * Test error handling
     */
    testErrorHandling() {
        console.log('🛡️ Testing error handling...');
        
        const errorTestCases = [
            { name: 'Null Data', data: null },
            { name: 'Empty Data', data: {} },
            { name: 'Invalid Data', data: 'invalid' },
            { name: 'Circular Reference', data: this.createCircularReference() }
        ];
        
        const results = [];
        
        for (const testCase of errorTestCases) {
            try {
                const analysis = window.vofcMatcher.analyzeAssessment(testCase.data);
                results.push({
                    testCase: testCase.name,
                    handled: true,
                    result: 'Graceful handling'
                });
                console.log(`  ${testCase.name}: ✅ Handled gracefully`);
                
            } catch (error) {
                results.push({
                    testCase: testCase.name,
                    handled: false,
                    error: error.message
                });
                console.log(`  ${testCase.name}: ❌ Error - ${error.message}`);
            }
        }
        
        return results;
    }
    
    /**
     * Create circular reference for testing
     */
    createCircularReference() {
        const obj = { test: 'value' };
        obj.self = obj;
        return obj;
    }
    
    /**
     * Get system statistics
     */
    getSystemStats() {
        if (window.vofcMatcher && window.vofcMatcher.getStats) {
            const stats = window.vofcMatcher.getStats();
            console.log('📊 System Statistics:');
            console.log(`  Vulnerabilities: ${stats.vulnerabilities}`);
            console.log(`  Options: ${stats.options}`);
            console.log(`  Field Mappings: ${stats.fieldMappings}`);
            console.log(`  Analysis Rules: ${stats.analysisRules}`);
            console.log(`  Cache Size: ${stats.cacheSize}`);
            console.log(`  Initialized: ${stats.isInitialized}`);
            return stats;
        } else {
            console.log('⚠️ System statistics not available');
            return null;
        }
    }
    
    /**
     * Clear cache and test
     */
    clearCacheAndTest() {
        console.log('🗑️ Clearing cache and testing...');
        
        if (window.vofcMatcher && window.vofcMatcher.clearCache) {
            window.vofcMatcher.clearCache();
            console.log('✅ Cache cleared');
        }
        
        // Run a quick test to verify cache clearing
        return this.runQuickTest();
    }
}

// Create global test runner instance
window.vofcTestRunner = new VOFCTestRunner();

// Add convenience functions to global scope
window.runVOFCTests = () => window.vofcTestRunner.runTests();
window.runQuickVOFCTest = () => window.vofcTestRunner.runQuickTest();
window.testVOFCDetection = () => window.vofcTestRunner.testVulnerabilityDetection();
window.testVOFCFieldMapping = () => window.vofcTestRunner.testFieldMapping();
window.testVOFCErrorHandling = () => window.vofcTestRunner.testErrorHandling();
window.getVOFCCStats = () => window.vofcTestRunner.getSystemStats();
window.clearVOFCache = () => window.vofcTestRunner.clearCacheAndTest();

console.log('🧪 VOFC Test Runner loaded!');
console.log('Available commands:');
console.log('  runVOFCTests() - Run comprehensive tests');
console.log('  runQuickVOFCTest() - Run quick performance test');
console.log('  testVOFCDetection() - Test vulnerability detection');
console.log('  testVOFCFieldMapping() - Test field mapping');
console.log('  testVOFCErrorHandling() - Test error handling');
console.log('  getVOFCCStats() - Get system statistics');
console.log('  clearVOFCache() - Clear cache and test');
